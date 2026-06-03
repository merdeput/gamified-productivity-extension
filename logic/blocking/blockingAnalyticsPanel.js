/**
 * blockingAnalyticsPanel.js
 *
 * UI helpers for the website-blocking feature inside the popup.
 * Call `initBlockingUI(sendMessage)` once from ui.js after DOM is ready.
 *
 * Responsibilities:
 *   1. Render the Analytics panel inside Settings.
 *   2. Wire the "Reset" button on the analytics panel.
 */

import {
  BLOCK_REASONS,
  DEFAULT_BLOCKING_ANALYTICS
} from "./blockingConstants.js";

// ─── Exported init ────────────────────────────────────────────────────────────

/**
 * @param {function(Object): Promise<Object>} sendMessage
 *   A function that sends a chrome.runtime message and returns the response data.
 *   Signature: sendMessage({ type, payload }) → Promise<state>
 */
export function initBlockingUI(sendMessage) {
  _sendMessage = sendMessage;
  _initAnalyticsScreen();
}

// ─── Module-level state ───────────────────────────────────────────────────────

let _sendMessage = null;

// ─── Analytics panel ──────────────────────────────────────────────────────────

function _initAnalyticsScreen() {
  const resetBtn = document.getElementById("resetAnalyticsBtn");
  resetBtn?.addEventListener("click", async () => {
    if (!_sendMessage) return;
    await _sendMessage({ type: "BLOCKING_RESET_ANALYTICS", payload: {} });
    // Re-render with zeroed analytics
    renderAnalytics(DEFAULT_BLOCKING_ANALYTICS);
  });
}

/**
 * Render the analytics panel with the given analytics object.
 * Call this from ui.js whenever the state is refreshed and the analytics
 * screen is active (or when switching to it).
 *
 * @param {Object} analytics  – state.blockingAnalytics
 */
export function renderAnalytics(analytics = {}) {
  const a = { ...DEFAULT_BLOCKING_ANALYTICS, ...analytics };

  // ── Summary boxes ──────────────────────────────────────────────────────────
  _setText("aStatAttempts",   a.blockAttempts);
  _setText("aStatAllowed",    a.allowed);
  _setText("aStatDenied",     a.denied);
  _setText("aStatResistance", a.resistanceEvents);
  _setText("aCoinsAwarded",   a.coinsAwarded);
  _setText("aFlowersRemoved", a.flowersRemoved);

  // ── Empty state ────────────────────────────────────────────────────────────
  const emptyEl   = document.getElementById("analyticsEmpty");
  const summaryEl = document.getElementById("analyticsSummary");
  const isEmpty   = a.blockAttempts === 0;
  emptyEl  ?.classList.toggle("hidden", !isEmpty);
  summaryEl?.classList.toggle("hidden",  isEmpty);

  if (isEmpty) return;

  // ── Reason breakdown ───────────────────────────────────────────────────────
  const listEl = document.getElementById("analyticsReasonList");
  if (!listEl) return;

  listEl.innerHTML = "";

  const reasonCounts = { ...a.reasonCounts };
  const maxCount     = Math.max(1, ...Object.values(reasonCounts));

  BLOCK_REASONS.forEach((reason) => {
    const count   = reasonCounts[reason.id] || 0;
    const barPct  = Math.round((count / maxCount) * 100);

    const item    = document.createElement("div");
    item.className = "analytics-reason-item";

    item.innerHTML = `
      <span class="analytics-reason-emoji">${reason.emoji}</span>
      <span class="analytics-reason-label">${reason.label}</span>
      <div class="analytics-reason-bar-wrap">
        <div class="analytics-reason-bar" style="width: ${barPct}%"></div>
      </div>
      <span class="analytics-reason-count">${count}</span>
    `;

    listEl.appendChild(item);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    // Find the .analytics-stat-value child or use the element itself
    const valueEl = el.querySelector(".analytics-stat-value") || el;
    valueEl.textContent = String(value);
  }
}
