/**
 * blockingBackground.js
 *
 * Handles website blocking at the browser level.
 *
 * How it works:
 * 1.  When a focus mission is active (work or rest timer running), this module
 *     reads `softBlockedSites` and `hardBlockedSites` from the active mission.
 * 2.  `chrome.webNavigation.onBeforeNavigate` is used to detect when the user
 *     tries to navigate to a blocked site.
 * 3.  A content script (`blockingContent.js`) is injected into the tab to show
 *     the blocking UI *before* the page finishes loading.
 * 4.  Because Manifest V3 does not allow synchronous blocking in content
 *     scripts, we use a redirect to `blockedSitePage.html` (a bundled extension page)
 *     and pass all context via URL parameters.
 *
 * Message protocol (popup / content script ↔ background):
 *   BLOCKING_GET_CONTEXT  → returns current blocking context for the tab
 *   BLOCKING_ALLOW        → user chose to proceed (reason provided)
 *   BLOCKING_DENY         → hard-mode: navigation remains blocked
 *   BLOCKING_RESISTANCE   → user clicked "Return to Focus"
 *   BLOCKING_RECORD_ATTEMPT → record that a site was intercepted
 *   BLOCKING_GET_ANALYTICS  → return current analytics snapshot
 *   BLOCKING_RESET_ANALYTICS → reset analytics to zero
 */

import { getState, saveState } from "../storage.js";
import { normalizeState } from "../utils.js";
import { RUNNING_MODES } from "../constants.js";
import {
  allowBlockedAccess,
  denyBlockedAccess,
  recordBlockAttempt,
  recordResistance,
  recordReasonSelected,
  getBlockingAnalytics,
  resetBlockingAnalytics
} from "./blockingActions.js";
import { BLOCK_MODES } from "./blockingConstants.js";

const ALLOWED_NAVIGATION_TTL_MS = 10000;
const allowedNavigations = new Map();

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Normalise a URL into a bare hostname (e.g. "www.youtube.com" → "youtube.com").
 * @param {string} url
 * @returns {string}
 */
function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Check whether `hostname` matches any entry in `siteList`.
 * Each entry in siteList is already a normalised hostname (no www, no protocol).
 * We match exact hostname OR if the site list entry is a suffix of the hostname
 * (so "youtube.com" also blocks "music.youtube.com").
 *
 * @param {string} hostname
 * @param {string[]} siteList
 * @returns {boolean}
 */
function isHostnameBlocked(hostname, siteList) {
  if (!hostname || !Array.isArray(siteList)) return false;
  return siteList.some(
    (site) => hostname === site || hostname.endsWith(`.${site}`)
  );
}

function allowNextNavigation(tabId, url) {
  const hostname = hostnameFromUrl(url);
  if (!Number.isInteger(tabId) || !hostname) return;
  allowedNavigations.set(tabId, {
    hostname,
    expiresAt: Date.now() + ALLOWED_NAVIGATION_TTL_MS
  });
}

function consumeAllowedNavigation(tabId, url) {
  const allowed = allowedNavigations.get(tabId);
  if (!allowed) return false;

  if (Date.now() > allowed.expiresAt) {
    allowedNavigations.delete(tabId);
    return false;
  }

  const hostname = hostnameFromUrl(url);
  const matches = hostname === allowed.hostname || hostname.endsWith(`.${allowed.hostname}`);
  if (matches) {
    allowedNavigations.delete(tabId);
    return true;
  }

  return false;
}

// ─── Active blocking context ──────────────────────────────────────────────────

/**
 * Returns the active blocking context if a mission is running and the given
 * URL matches a blocked site.
 *
 * @param {Object} state  – full app state
 * @param {string} url    – URL being navigated to
 * @returns {{ mode: string, site: string, mission: Object } | null}
 */
export function getBlockingContext(state, url) {
  const mission = state.activeMission;

  // Only block while the timer is actively running (work or rest)
  if (!mission || !RUNNING_MODES.includes(mission.timerMode)) return null;

  const hostname = hostnameFromUrl(url);
  if (!hostname) return null;

  const hardBlocked = isHostnameBlocked(hostname, mission.hardBlockedSites);
  const softBlocked = isHostnameBlocked(hostname, mission.softBlockedSites);

  if (hardBlocked) {
    return { mode: BLOCK_MODES.HARD, site: hostname, mission };
  }
  if (softBlocked) {
    return { mode: BLOCK_MODES.SOFT, site: hostname, mission };
  }

  return null;
}

// ─── Serialise mission for URL parameters ─────────────────────────────────────

function missionToParams(mission, state) {
  return new URLSearchParams({
    mode:               mission.mode,
    site:               mission.site,
    missionId:          mission.mission.id,
    taskTitle:          mission.mission.taskTitle,
    timerMode:          mission.mission.timerMode,
    currentSession:     String(mission.mission.currentSession),
    totalSessions:      String(mission.mission.totalSessions),
    workDurationMinutes:String(mission.mission.workDurationMinutes),
    totalFocusMinutes:  String(state.totalFocusMinutes || 0),
    gardenCoins:        String(state.garden?.coins || 0),
    gardenPlantCount:   String(state.garden?.plants?.length || 0),
    // Pass the original URL so the blocked-site page can redirect after allow.
    originalUrl:        mission.originalUrl || ""
  });
}

// ─── webNavigation listener ───────────────────────────────────────────────────

/**
 * Register the webNavigation listener.
 * Call this once from background.js.
 */
export function initBlockingNavigation() {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only intercept top-level navigation
    if (details.frameId !== 0) return;

    // Ignore the blocking page itself to avoid redirect loops
    const extensionOrigin = chrome.runtime.getURL("");
    if (details.url.startsWith(extensionOrigin)) return;

    if (consumeAllowedNavigation(details.tabId, details.url)) return;

    const state = await getState();
    const ctx   = getBlockingContext(state, details.url);
    if (!ctx) return;

    // Record the block attempt in analytics
    const attemptResult = recordBlockAttempt(state, {
      site:      ctx.site,
      mode:      ctx.mode,
      missionId: ctx.mission.id
    });
    await saveState(attemptResult.state);

    // Build redirect URL to the blocking page
    const params = missionToParams(
      { ...ctx, originalUrl: details.url },
      attemptResult.state
    );
    const blockingPageUrl = chrome.runtime.getURL(`logic/blocking/blockedSitePage.html?${params}`);

    // Redirect the tab to the blocking page
    chrome.tabs.update(details.tabId, { url: blockingPageUrl });
  });
}

// ─── Message handlers ─────────────────────────────────────────────────────────

/**
 * Handle messages sent from blockedSitePage.html.
 * Returns a Promise<any> with the response payload.
 *
 * @param {{ type: string, payload: Object }} message
 * @returns {Promise<any>}
 */
export async function handleBlockingMessage(message, sender = {}) {
  const { type, payload = {} } = message;

  if (type === "BLOCKING_ALLOW") {
    allowNextNavigation(sender.tab?.id, payload.originalUrl);

    // User gave a reason and chose to proceed
    return runBlockingStateAction((state) =>
      allowBlockedAccess(state, {
        reasonId: payload.reasonId,
        mode:     payload.mode
      })
    );
  }

  if (type === "BLOCKING_DENY") {
    // Hard mode – record denial
    return runBlockingStateAction((state) =>
      denyBlockedAccess(state, { reasonId: payload.reasonId })
    );
  }

  if (type === "BLOCKING_RESISTANCE") {
    // User clicked "Return to Focus"
    return runBlockingStateAction(recordResistance);
  }

  if (type === "BLOCKING_RECORD_REASON") {
    return runBlockingStateAction((state) =>
      recordReasonSelected(state, { reasonId: payload.reasonId })
    );
  }

  if (type === "BLOCKING_GET_ANALYTICS") {
    const state = await getState();
    return getBlockingAnalytics(state);
  }

  if (type === "BLOCKING_RESET_ANALYTICS") {
    return runBlockingStateAction(resetBlockingAnalytics);
  }

  return null; // unknown type — let background.js handle it
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function runBlockingStateAction(action) {
  const state  = await getState();
  const result = action(state);
  await saveState(result.state);
  return result.state;
}
