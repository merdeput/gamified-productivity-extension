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
    { id: "study_research", label: "Study / Research", emoji: "📚", productive: true  },
    { id: "work",           label: "Work",             emoji: "💼", productive: true  },
    { id: "communication",  label: "Communication",    emoji: "💬", productive: true  },
    { id: "entertainment",  label: "Entertainment",    emoji: "🎮", productive: false },
    { id: "other",          label: "Other",            emoji: "🤔", productive: false },
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
    "Your focus is your superpower. Use it wisely. ⚡",
  ];

  // ─── Frog mascot config ─────────────────────────────────────────────────────

  /**
   * All 5 frog states, frame counts, and display weights (higher = appears more often).
   * The frog is stationary so we play one state as a looping gif, then switch.
   */
  const FROG_STATES = [
    { name: "idle",  frames: 3, weight: 40, durationMs: () => 2000 + Math.random() * 2000 },
    { name: "croak", frames: 4, weight: 25, durationMs: () => 1200 + Math.random() * 1000 },
    { name: "hop",   frames: 5, weight: 15, durationMs: () =>  800 + Math.random() *  600 },
    { name: "jump",  frames: 4, weight: 10, durationMs: () =>  600 + Math.random() *  500 },
    { name: "shock", frames: 5, weight: 10, durationMs: () =>  700 + Math.random() *  500 },
  ];

  const FROG_FRAME_SIZE   = 32;  // px – sprite is 32×32 per frame
  const FROG_SCALE        = 3;   // render at 3× for visibility
  const FROG_FRAME_MS     = 130; // ms per animation frame
  // Fixed south-facing direction (row index 4 in the sprite sheet)
  const FROG_DIRECTION_ROW = 4;

  // ─── Parse URL params ────────────────────────────────────────────────────────

  const params      = new URLSearchParams(location.search);
  const mode        = params.get("mode")        || "soft";
  const site        = params.get("site")        || "unknown site";
  const taskTitle   = params.get("taskTitle")   || "your task";
  const timerMode   = params.get("timerMode")   || "work";
  const currentSess = parseInt(params.get("currentSession"),   10) || 0;
  const totalSess   = parseInt(params.get("totalSessions"),    10) || 0;
  const focusMins   = parseInt(params.get("totalFocusMinutes"),10) || 0;
  const coins       = parseInt(params.get("gardenCoins"),      10) || 0;
  const plantCount  = parseInt(params.get("gardenPlantCount"), 10) || 0;
  const originalUrl = params.get("originalUrl") || "";
  const missionId   = params.get("missionId")   || "";

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

  modeBadge.textContent = mode === "hard" ? "Hard Mode" : "Soft Mode";
  modeBadge.className   = `mode-badge ${mode}`;

  siteName.textContent      = site;
  blockSubtitle.textContent =
    mode === "hard"
      ? "This site is on your hard-block list. Access requires a productive reason."
      : "This site is on your soft-block list.";

  sessionStat.textContent   = `${currentSess} / ${totalSess}`;
  timerModeStat.textContent = timerMode;
  focusStat.textContent     = `${focusMins} min`;
  plantsStat.textContent    = `${plantCount} 🌱`;
  coinsStat.textContent     = String(coins);

  if (mode === "hard") {
    progressCard.style.display   = "none";
    motivationCard.style.display = "none";
  } else {
    const msgIndex = Math.abs(
      missionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    motivationText.textContent =
      MOTIVATIONAL_MESSAGES[msgIndex % MOTIVATIONAL_MESSAGES.length];
  }

  coinRewardPill.textContent = `+${RETURN_BONUS_COINS} coins`;

  // ─── Frog mascot ─────────────────────────────────────────────────────────────

  /**
   * Weighted random state picker.
   * Returns a random FROG_STATES entry, weighted by .weight.
   */
  function pickFrogState(excludeName) {
    const pool = FROG_STATES.filter(s => s.name !== excludeName);
    const total = pool.reduce((acc, s) => acc + s.weight, 0);
    let r = Math.random() * total;
    for (const s of pool) {
      r -= s.weight;
      if (r <= 0) return s;
    }
    return pool[0];
  }

  /**
   * Build the frog mascot DOM and start its animation loop.
   * The frog is injected into #frogMascotWrapper (created dynamically if absent).
   */
  function initFrogMascot() {
    // Resolve asset URL (works inside a Chrome extension; falls back for dev)
    const baseUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("assets/")
        : "./assets/";

    // Container
    const wrapper = document.getElementById("frogMascotWrapper");
    if (!wrapper) return;

    const rendered  = FROG_FRAME_SIZE * FROG_SCALE;

    const el        = document.createElement("div");
    el.id           = "frogSprite";
    el.style.cssText = `
      width:            ${rendered}px;
      height:           ${rendered}px;
      image-rendering:  pixelated;
      background-repeat: no-repeat;
      flex-shrink:      0;
    `;
    wrapper.appendChild(el);

    // ── Animation state ──────────────────────────────────────────────────────
    let currentStateObj  = pickFrogState(null);  // start with any state
    let currentFrame     = 0;
    let frameTimer       = 0;
    let stateTimer       = 0;
    let stateDuration    = currentStateObj.durationMs();
    let lastTimestamp    = null;
    let rafId            = null;
    let destroyed        = false;

    function applySprite() {
      const s   = currentStateObj;
      const url = `${baseUrl}animal/frog/frog_${s.name}.png`;
      const fw  = FROG_FRAME_SIZE;
      const sc  = FROG_SCALE;

      // Sheet: s.frames columns × 8 rows, scaled up
      el.style.backgroundImage    = `url('${url}')`;
      el.style.backgroundSize     = `${s.frames * fw * sc}px ${8 * fw * sc}px`;
      // Column = currentFrame, Row = FROG_DIRECTION_ROW
      el.style.backgroundPosition =
        `-${currentFrame * fw * sc}px -${FROG_DIRECTION_ROW * fw * sc}px`;
    }

    function applyFrame() {
      const fw = FROG_FRAME_SIZE;
      const sc = FROG_SCALE;
      el.style.backgroundPosition =
        `-${currentFrame * fw * sc}px -${FROG_DIRECTION_ROW * fw * sc}px`;
    }

    function enterState(stateObj) {
      currentStateObj = stateObj;
      currentFrame    = 0;
      frameTimer      = 0;
      stateTimer      = 0;
      stateDuration   = stateObj.durationMs();
      applySprite();
    }

    // Initial render
    applySprite();

    function tick(timestamp) {
      if (destroyed) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min(timestamp - lastTimestamp, 100);
      lastTimestamp = timestamp;

      // Advance frame
      frameTimer += dt;
      if (frameTimer >= FROG_FRAME_MS) {
        frameTimer -= FROG_FRAME_MS;
        currentFrame = (currentFrame + 1) % currentStateObj.frames;
        applyFrame();
      }

      // Advance state timer → pick new random state
      stateTimer += dt;
      if (stateTimer >= stateDuration) {
        enterState(pickFrogState(currentStateObj.name));
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    // Cleanup when page unloads
    window.addEventListener("pagehide", () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
    }, { once: true });
  }

  // Inject frog wrapper after header, before blocked-banner
  (function injectFrogWrapper() {
    const page = document.getElementById("page");
    if (!page) return;

    const wrapper = document.createElement("div");
    wrapper.id    = "frogMascotWrapper";

    // Insert right after the header div
    const header = page.querySelector(".header");
    if (header && header.nextSibling) {
      page.insertBefore(wrapper, header.nextSibling);
    } else {
      page.appendChild(wrapper);
    }
  })();

  // Start frog after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFrogMascot);
  } else {
    initFrogMascot();
  }

  // ─── Populate reason buttons ─────────────────────────────────────────────────

  let selectedReasonId = null;

  REASONS.forEach((reason) => {
    const btn         = document.createElement("button");
    btn.type          = "button";
    btn.className     = "reason-btn";
    btn.dataset.reasonId   = reason.id;
    btn.dataset.productive = reason.productive ? "true" : "false";
    btn.innerHTML     = `<span class="emoji">${reason.emoji}</span> ${reason.label}`;
    btn.addEventListener("click", () => onReasonSelected(reason.id, reason.productive));
    reasonGrid.appendChild(btn);
  });

  // ─── Reason selection handler ────────────────────────────────────────────────

  function onReasonSelected(reasonId, productive) {
    selectedReasonId = reasonId;

    reasonGrid.querySelectorAll(".reason-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.reasonId === reasonId);
    });

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
      penaltyWarning.classList.remove("visible");
      proceedBtn.disabled    = false;
      proceedBtn.textContent = "Continue to site →";
    } else {
      penaltyWarning.classList.add("visible");
      proceedBtn.disabled    = false;
      proceedBtn.textContent = "Continue to site (25% flowers removed) →";
    }
  }

  // ─── Hard mode ───────────────────────────────────────────────────────────────

  function handleHardModeReason(productive) {
    if (productive) {
      deniedNotice.classList.remove("visible");
      proceedBtn.disabled    = false;
      proceedBtn.textContent = "Continue to site →";
    } else {
      deniedNotice.classList.add("visible");
      proceedBtn.disabled    = true;
      proceedBtn.textContent = "Access Denied";
      proceedBtn.className   = "btn btn-denied";

      sendMessage({ type: "BLOCKING_DENY", payload: { reasonId: selectedReasonId } });
    }
  }

  // ─── Return to Focus ─────────────────────────────────────────────────────────

  returnBtn.addEventListener("click", async () => {
    lockUI();
    await sendMessage({ type: "BLOCKING_RESISTANCE" });

    successOutcome.textContent =
      `✅ Great work resisting ${site}! +${RETURN_BONUS_COINS} coins added to your garden. Keep focusing on "${taskTitle}".`;
    successOutcome.classList.add("visible");
    hideActionsArea();

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

    await sendMessage({
      type:    "BLOCKING_ALLOW",
      payload: { reasonId: selectedReasonId, mode, originalUrl, site },
    });

    if (!productive && mode === "soft") {
      successOutcome.textContent =
        "🌿 Access granted. Some growing flowers have been removed as a reminder to stay focused.";
    } else {
      successOutcome.textContent = "✅ Access granted. Stay productive!";
    }
    successOutcome.classList.add("visible");
    hideActionsArea();

    if (originalUrl) {
      setTimeout(() => { location.href = originalUrl; }, 900);
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function lockUI() {
    returnBtn.disabled  = true;
    proceedBtn.disabled = true;
    reasonGrid.querySelectorAll(".reason-btn").forEach(b => (b.disabled = true));
  }

  function hideActionsArea() {
    returnBtn.style.display  = "none";
    proceedBtn.style.display = "none";
    coinNotice.style.display = "none";
    penaltyWarning.classList.remove("visible");
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => resolve(response));
      } else {
        console.log("[blockedSitePage] sendMessage:", message);
        resolve(null);
      }
    });
  }
})();