/**
 * blockingConstants.js
 * All constants for the website-blocking feature.
 */

// ─── Modes ────────────────────────────────────────────────────────────────────

export const BLOCK_MODES = {
  SOFT: "soft",
  HARD: "hard"
};

// ─── Reasons ──────────────────────────────────────────────────────────────────

export const BLOCK_REASONS = [
  {
    id: "study_research",
    label: "Study / Research",
    emoji: "📚",
    productive: true
  },
  {
    id: "work",
    label: "Work",
    emoji: "💼",
    productive: true
  },
  {
    id: "communication",
    label: "Communication",
    emoji: "💬",
    productive: true
  },
  {
    id: "entertainment",
    label: "Entertainment",
    emoji: "🎮",
    productive: false
  },
  {
    id: "other",
    label: "Other",
    emoji: "🤔",
    productive: false
  }
];

export const PRODUCTIVE_REASON_IDS = new Set(
  BLOCK_REASONS.filter(r => r.productive).map(r => r.id)
);

export function isProductiveReason(reasonId) {
  return PRODUCTIVE_REASON_IDS.has(reasonId);
}

// ─── Penalties & Rewards ──────────────────────────────────────────────────────

/** Fraction of currently-growing plants removed on non-productive access (Soft Mode) */
export const SOFT_PENALTY_FRACTION = 0.25;

/** Bonus coins awarded when user clicks "Return to Focus" */
export const RETURN_TO_FOCUS_BONUS_COINS = 5;

// ─── Analytics event types ────────────────────────────────────────────────────

export const BLOCK_EVENT_TYPES = {
  BLOCK_ATTEMPT:      "block_attempt",
  ALLOWED:            "allowed",
  DENIED:             "denied",
  RESISTANCE:         "resistance",        // user clicked "Return to Focus"
  COINS_AWARDED:      "coins_awarded",
  FLOWERS_REMOVED:    "flowers_removed",
  REASON_SELECTED:    "reason_selected"
};

// ─── Default analytics state ──────────────────────────────────────────────────

export const DEFAULT_BLOCKING_ANALYTICS = {
  blockAttempts:    0,
  allowed:          0,
  denied:           0,
  resistanceEvents: 0,
  coinsAwarded:     0,
  flowersRemoved:   0,
  reasonCounts: {
    study_research: 0,
    work:           0,
    communication:  0,
    entertainment:  0,
    other:          0
  }
};

// ─── Messages shown on the blocking / reflection screen ───────────────────────

export const MOTIVATIONAL_MESSAGES = [
  "You're just a few focused minutes away from growing your next flower. 🌱",
  "Your garden is counting on you — stay in the zone!",
  "Every minute of focus makes your garden bloom a little more. 🌸",
  "You've already made great progress today. Don't break the streak!",
  "Your future self will thank you for staying focused right now.",
  "One more focused session and a new flower could be yours. 🌻",
  "The best view comes after the hardest climb. Keep going!",
  "Your focus is your superpower. Use it wisely. ⚡"
];

export function getMotivationalMessage(seed = Date.now()) {
  return MOTIVATIONAL_MESSAGES[seed % MOTIVATIONAL_MESSAGES.length];
}
