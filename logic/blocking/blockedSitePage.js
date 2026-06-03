/**
 * blockedSitePage.js
 *
 * Drives the blocked-site redirect page UI.
 *
 * URL parameters (all strings):
 *   mode                – "soft" | "hard"
 *   site                – hostname being blocked
 *   missionId           – active mission id
 *   taskTitle           – active task title
 *   timerMode           – "work" | "rest"
 *   currentSession      – number
 *   totalSessions       – number
 *   workDurationMinutes – number
 *   totalFocusMinutes   – number
 *   gardenCoins         – number
 *   gardenPlantCount    – number
 *   originalUrl         – the URL the user was trying to visit
 */

(function () {
  "use strict";

  // ─── Constants ──────────────────────────────────────────────────────────────

  const REASONS = [
    { id: "study_research", label: "Study / Research", emoji: "📚", productive: true },
    { id: "work",           label: "Work",             emoji: "💼", productive: true },
    { id: "communication",  label: "Communication",    emoji: "💬", productive: true },
    { id: "entertainment",  label: "Entertainment",    emoji: "🎮", productive: false },
    { id: "other",          label: "Other",            emoji: "🤔", productive: false }
  ];

  const RETURN_BONUS_COINS = 5;

  const MOTIVATIONAL_MESSAGES = [
    "You're just a few focused minutes away from growing your next flower. 🌱",
    "Your garden is counting on you — stay in the zone!",
    "Every minute of focus makes your garden bloom a little more. 🌸",
    "You've already made great progress today. Don't break the streak!",
    "Your future self will thank you for staying focused right now.",
    "One more focused session and a new flower could be yours. 🌻",
    "The best view comes after the hardest climb. Keep going!",
    "Your focus is your superpower. Use it wisely. ⚡"
  ];

  // ─── Parse URL params ────────────────────────────────────────────────────────

  const params       = new URLSearchParams(location.search);
  const mode         = params.get("mode")         || "soft";
  const site         = params.get("site")         || "unknown site";
  const taskTitle    = params.get("taskTitle")    || "your task";
  const timerMode    = params.get("timerMode")    || "work";
  const currentSess  = parseInt(params.get("currentSession"),      10) || 0;
  const totalSess    = parseInt(params.get("totalSessions"),        10) || 0;
  const focusMins    = parseInt(params.get("totalFocusMinutes"),    10) || 0;
  const coins        = parseInt(params.get("gardenCoins"),          10) || 0;
  const plantCount   = parseInt(params.get("gardenPlantCount"),     10) || 0;
  const originalUrl  = params.get("originalUrl") || "";
  const missionId    = params.get("missionId")   || "";

  // ─── Element refs ────────────────────────────────────────────────────────────

  const modeBadge      = document.getElementById("modeBadge");
  const siteName       = document.getElementById("siteName");
  const blockSubtitle  = document.getElementById("blockSubtitle");
  const progressCard   = document.getElementById("progressCard");
  const motivationCard = document.getElementById("motivationCard");
  const motivationText = document.getElementById("motivationText");
  const sessionStat    = document.getElementById("sessionStat");
  const timerModeStat  = document.getElementById("timerModeStat");
  const focusStat      = document.getElementById("focusStat");
  const plantsStat     = document.getElementById("plantsStat");
  const coinsStat      = document.getElementById("coinsStat");
  const reasonGrid     = document.getElementById("reasonGrid");
  const penaltyWarning = document.getElementById("penaltyWarning");
  const deniedNotice   = document.getElementById("deniedNotice");
  const returnBtn      = document.getElementById("returnBtn");
  const coinNotice     = document.getElementById("coinNotice");
  const coinRewardPill = document.getElementById("coinRewardPill");
  const proceedBtn     = document.getElementById("proceedBtn");
  const successOutcome = document.getElementById("successOutcome");
  const blockedOutcome = document.getElementById("blockedOutcome");

  // ─── Populate static UI ──────────────────────────────────────────────────────

  // Mode badge
  modeBadge.textContent = mode === "hard" ? "Hard Mode" : "Soft Mode";
  modeBadge.className = `mode-badge ${mode}`;

  // Blocked site info
  siteName.textContent = site;
  blockSubtitle.textContent =
    mode === "hard"
      ? "This site is on your hard-block list. Access requires a productive reason."
      : "This site is on your soft-block list.";

  // Stats
  sessionStat.textContent   = `${currentSess} / ${totalSess}`;
  timerModeStat.textContent = timerMode;
  focusStat.textContent     = `${focusMins} min`;
  plantsStat.textContent    = `${plantCount} 🌱`;
  coinsStat.textContent     = String(coins);

  // Motivational message (soft mode only)
  if (mode === "hard") {
    progressCard.style.display   = "none";
    motivationCard.style.display = "none";
  } else {
    const msgIndex = Math.abs(missionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    motivationText.textContent = MOTIVATIONAL_MESSAGES[msgIndex % MOTIVATIONAL_MESSAGES.length];
  }

  // Coin reward pill
  coinRewardPill.textContent = `+${RETURN_BONUS_COINS} coins`;

  // ─── Populate reason buttons ─────────────────────────────────────────────────

  let selectedReasonId = null;

  REASONS.forEach((reason) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reason-btn";
    btn.dataset.reasonId = reason.id;
    btn.dataset.productive = reason.productive ? "true" : "false";
    btn.innerHTML = `<span class="emoji">${reason.emoji}</span> ${reason.label}`;

    btn.addEventListener("click", () => onReasonSelected(reason.id, reason.productive));
    reasonGrid.appendChild(btn);
  });

  // ─── Reason selection handler ────────────────────────────────────────────────

  function onReasonSelected(reasonId, productive) {
    selectedReasonId = reasonId;

    // Highlight selected button
    reasonGrid.querySelectorAll(".reason-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.reasonId === reasonId);
    });

    // Send reason to background for analytics
    sendMessage({ type: "BLOCKING_RECORD_REASON", payload: { reasonId } });

    if (mode === "soft") {
      handleSoftModeReason(productive);
    } else {
      handleHardModeReason(productive);
    }
  }

  // ─── Soft mode ───────────────────────────────────────────────────────────────

  function handleSoftModeReason(productive) {
    if (productive) {
      // Allow — no penalty
      penaltyWarning.classList.remove("visible");
      proceedBtn.disabled = false;
      proceedBtn.textContent = "Continue to site →";
    } else {
      // Allow — but with penalty warning
      penaltyWarning.classList.add("visible");
      proceedBtn.disabled = false;
      proceedBtn.textContent = "Continue to site (25% flowers removed) →";
    }
  }

  // ─── Hard mode ───────────────────────────────────────────────────────────────

  function handleHardModeReason(productive) {
    if (productive) {
      // Allow
      deniedNotice.classList.remove("visible");
      proceedBtn.disabled = false;
      proceedBtn.textContent = "Continue to site →";
    } else {
      // Deny — lock proceed button
      deniedNotice.classList.add("visible");
      proceedBtn.disabled = true;
      proceedBtn.textContent = "Access Denied";
      proceedBtn.className = "btn btn-denied";

      // Notify background
      sendMessage({ type: "BLOCKING_DENY", payload: { reasonId: selectedReasonId } });
    }
  }

  // ─── Return to Focus ─────────────────────────────────────────────────────────

  returnBtn.addEventListener("click", async () => {
    lockUI();

    await sendMessage({ type: "BLOCKING_RESISTANCE" });

    // Show success message
    successOutcome.textContent =
      `✅ Great work resisting ${site}! +${RETURN_BONUS_COINS} coins added to your garden. Keep focusing on "${taskTitle}".`;
    successOutcome.classList.add("visible");

    hideActionsArea();

    // Redirect back or close tab after short delay
    setTimeout(() => {
      if (history.length > 1) {
        history.back();
      } else {
        window.close();
      }
    }, 2200);
  });

  // ─── Proceed ─────────────────────────────────────────────────────────────────

  proceedBtn.addEventListener("click", async () => {
    if (!selectedReasonId) return;

    lockUI();

    const productive = REASONS.find(r => r.id === selectedReasonId)?.productive ?? true;

    // Notify background
    await sendMessage({
      type:    "BLOCKING_ALLOW",
      payload: { reasonId: selectedReasonId, mode, originalUrl, site }
    });

    // Show feedback
    if (!productive && mode === "soft") {
      successOutcome.textContent =
        `🌿 Access granted. Some growing flowers have been removed as a reminder to stay focused.`;
    } else {
      successOutcome.textContent =
        `✅ Access granted. Stay productive!`;
    }
    successOutcome.classList.add("visible");
    hideActionsArea();

    // Navigate to the original URL
    if (originalUrl) {
      setTimeout(() => { location.href = originalUrl; }, 900);
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function lockUI() {
    returnBtn.disabled  = true;
    proceedBtn.disabled = true;
    reasonGrid.querySelectorAll(".reason-btn").forEach(b => b.disabled = true);
  }

  function hideActionsArea() {
    returnBtn.style.display   = "none";
    proceedBtn.style.display  = "none";
    coinNotice.style.display  = "none";
    penaltyWarning.classList.remove("visible");
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          resolve(response);
        });
      } else {
        // Fallback for development / non-extension context
        console.log("[blockedSitePage] sendMessage:", message);
        resolve(null);
      }
    });
  }
})();
