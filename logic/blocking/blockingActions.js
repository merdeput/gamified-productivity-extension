/**
 * blockingActions.js
 * Pure state-mutation functions for the website-blocking feature.
 * All functions follow the same { state, alarm } contract as actions.js.
 */

import { normalizeState } from "../utils.js";
import {
  DEFAULT_BLOCKING_ANALYTICS,
  BLOCK_EVENT_TYPES,
  SOFT_PENALTY_FRACTION,
  RETURN_TO_FOCUS_BONUS_COINS,
  isProductiveReason
} from "./blockingConstants.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withState(state, alarm = null) {
  return { state: normalizeState(state), alarm };
}

function getAnalytics(state) {
  return {
    ...DEFAULT_BLOCKING_ANALYTICS,
    ...(state.blockingAnalytics || {})
  };
}

// ─── Record a block attempt ───────────────────────────────────────────────────

/**
 * Called every time navigation to a blocked site is intercepted.
 * @param {Object} state
 * @param {{ site: string, mode: string, missionId: string|null }} payload
 */
export function recordBlockAttempt(state, payload) {
  const analytics = getAnalytics(state);
  return withState({
    ...state,
    blockingAnalytics: {
      ...analytics,
      blockAttempts: analytics.blockAttempts + 1
    }
  });
}

// ─── Record a reason selection ────────────────────────────────────────────────

/**
 * Increments the counter for the chosen reason.
 * @param {Object} state
 * @param {{ reasonId: string }} payload
 */
export function recordReasonSelected(state, payload) {
  const analytics = getAnalytics(state);
  const reasonCounts = { ...analytics.reasonCounts };
  if (payload.reasonId in reasonCounts) {
    reasonCounts[payload.reasonId] = (reasonCounts[payload.reasonId] || 0) + 1;
  }
  return withState({
    ...state,
    blockingAnalytics: { ...analytics, reasonCounts }
  });
}

// ─── Allow access ─────────────────────────────────────────────────────────────

/**
 * Called when a blocked-site visit is allowed (productive reason, or soft-mode non-productive).
 * For non-productive soft-mode access: also removes 25 % of growing plants.
 *
 * @param {Object} state
 * @param {{ reasonId: string, mode: string }} payload
 */
export function allowBlockedAccess(state, payload) {
  const { reasonId, mode } = payload;
  const analytics = getAnalytics(state);
  const productive = isProductiveReason(reasonId);

  let nextState = {
    ...state,
    blockingAnalytics: {
      ...analytics,
      allowed: analytics.allowed + 1
    }
  };

  // Soft-mode non-productive penalty: remove 25 % of growing plants
  if (mode === "soft" && !productive) {
    nextState = applyFlowerPenalty(nextState);
  }

  return withState(nextState);
}

// ─── Deny access ─────────────────────────────────────────────────────────────

/**
 * Called when a hard-mode non-productive visit is denied.
 * @param {Object} state
 * @param {{ reasonId: string }} payload
 */
export function denyBlockedAccess(state, payload) {
  const analytics = getAnalytics(state);
  return withState({
    ...state,
    blockingAnalytics: {
      ...analytics,
      denied: analytics.denied + 1
    }
  });
}

// ─── Resistance (Return to Focus) ─────────────────────────────────────────────

/**
 * Called when the user clicks "Return to Focus" instead of proceeding.
 * Awards bonus coins and logs the resistance event.
 * @param {Object} state
 */
export function recordResistance(state) {
  const analytics = getAnalytics(state);
  const bonusCoins = RETURN_TO_FOCUS_BONUS_COINS;
  const currentCoins = Math.max(0, Number(state.garden?.coins || 0));

  return withState({
    ...state,
    garden: {
      ...(state.garden || { plants: [] }),
      coins: currentCoins + bonusCoins
    },
    blockingAnalytics: {
      ...analytics,
      resistanceEvents: analytics.resistanceEvents + 1,
      coinsAwarded: analytics.coinsAwarded + bonusCoins
    }
  });
}

// ─── Flower penalty ───────────────────────────────────────────────────────────

/**
 * Removes Math.ceil(plants.length * SOFT_PENALTY_FRACTION) "growing" plants.
 * A "growing" plant is one that has not yet reached its final stage
 * (we treat all plants as growing unless they carry a `mature: true` flag).
 *
 * @param {Object} state  (mutated copy is returned)
 * @returns {Object} new state
 */
function applyFlowerPenalty(state) {
  const plants = Array.isArray(state.garden?.plants)
    ? [...state.garden.plants]
    : [];

  // Identify growing plants (not yet marked mature)
  const growingIndices = plants
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.mature)
    .map(({ i }) => i);

  const removeCount = Math.ceil(growingIndices.length * SOFT_PENALTY_FRACTION);

  if (removeCount === 0) return state;

  // Remove the first N growing plants (oldest first)
  const toRemove = new Set(growingIndices.slice(0, removeCount));
  const remainingPlants = plants.filter((_, i) => !toRemove.has(i));

  const analytics = getAnalytics(state);

  return {
    ...state,
    garden: {
      ...(state.garden || {}),
      plants: remainingPlants
    },
    blockingAnalytics: {
      ...analytics,
      flowersRemoved: analytics.flowersRemoved + removeCount
    }
  };
}

// ─── Analytics snapshot ───────────────────────────────────────────────────────

/**
 * Returns the current analytics object (no state mutation).
 * @param {Object} state
 * @returns {Object}
 */
export function getBlockingAnalytics(state) {
  return getAnalytics(state);
}

/**
 * Resets analytics to defaults.
 * @param {Object} state
 */
export function resetBlockingAnalytics(state) {
  return withState({
    ...state,
    blockingAnalytics: { ...DEFAULT_BLOCKING_ANALYTICS }
  });
}
