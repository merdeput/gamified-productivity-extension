import { cleanSite } from "../../logic/utils.js";

const COMMON_BLOCKED_SITES = ["youtube.com", "facebook.com", "instagram.com", "x.com", "reddit.com"];

export function createBlockedSiteEditor({ $, getSelectedTaskId }) {
  let draft = [];
  let draftTaskId = "";
  let isDirty = false;

  function bindControls() {
    const input = $("blockedSiteInput");
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addCurrentSite();
    });

    $("addBlockedSiteBtn").addEventListener("click", addCurrentSite);
    $("quickAddBlockedSitesBtn").addEventListener("click", () => addCommonSites(getSelectedMode()));
  }

  function addCurrentSite() {
    const input = $("blockedSiteInput");
    addSite(getSelectedMode(), input.value);
    input.value = "";
    input.focus();
  }

  function loadFromTask(task) {
    const mission = task.mission || {};
    draft = mergeSites({
      softBlockedSites: task.softBlockedSites || mission.softBlockedSites || [],
      hardBlockedSites: task.hardBlockedSites || mission.hardBlockedSites || []
    });
    draftTaskId = task.id;
    isDirty = false;
    $("blockedSiteInput").value = "";
    $("blockedSiteModeInput").value = "soft";
    render();
  }

  function getSites() {
    return {
      softBlockedSites: draft.filter((item) => item.mode === "soft").map((item) => item.site),
      hardBlockedSites: draft.filter((item) => item.mode === "hard").map((item) => item.site)
    };
  }

  function markSaved(taskId) {
    isDirty = false;
    draftTaskId = taskId;
  }

  function hasUnsavedChangesForTask(taskId) {
    return isDirty && draftTaskId === taskId;
  }

  function addCommonSites(mode) {
    const changed = COMMON_BLOCKED_SITES
      .map((site) => addSite(mode, site, false))
      .some(Boolean);
    if (changed) render();
  }

  function addSite(mode, value, shouldRender = true) {
    const nextMode = normalizeMode(mode);
    const site = cleanSite(value);
    if (!site) return false;

    const existing = draft.find((item) => item.site === site);
    if (existing) {
      if (existing.mode === nextMode) return false;
      draft = draft.map((item) => item.site === site ? { ...item, mode: nextMode } : item);
      markDirty();
      if (shouldRender) render();
      return true;
    }

    draft = [...draft, { site, mode: nextMode }];
    markDirty();
    if (shouldRender) render();
    return true;
  }

  function updateSiteMode(site, mode) {
    const nextMode = normalizeMode(mode);
    const existing = draft.find((item) => item.site === site);
    if (!existing || existing.mode === nextMode) return;

    draft = draft.map((item) => item.site === site ? { ...item, mode: nextMode } : item);
    markDirty();
    render();
  }

  function removeSite(site) {
    const nextSites = draft.filter((item) => item.site !== site);
    if (nextSites.length === draft.length) return;
    draft = nextSites;
    markDirty();
    render();
  }

  function render() {
    renderList();
    renderSummary();
  }

  function renderList() {
    const list = $("blockedSitesList");
    list.innerHTML = "";

    if (!draft.length) {
      const empty = document.createElement("span");
      empty.className = "blocked-site-empty";
      empty.textContent = "No blocked sites";
      list.appendChild(empty);
      return;
    }

    draft.forEach(({ site, mode }) => {
      const pill = document.createElement("span");
      pill.className = "blocked-site-pill";

      const text = document.createElement("span");
      text.className = "blocked-site-domain";
      text.textContent = site;

      const modeSelect = document.createElement("select");
      modeSelect.className = "blocked-site-mode";
      modeSelect.setAttribute("aria-label", `Blocking mode for ${site}`);
      ["soft", "hard"].forEach((optionMode) => {
        const option = document.createElement("option");
        option.value = optionMode;
        option.textContent = optionMode === "hard" ? "Hard" : "Soft";
        option.selected = mode === optionMode;
        modeSelect.appendChild(option);
      });
      modeSelect.addEventListener("change", () => updateSiteMode(site, modeSelect.value));

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "blocked-site-remove";
      removeButton.setAttribute("aria-label", `Remove ${site}`);
      removeButton.textContent = "X";
      removeButton.addEventListener("click", () => removeSite(site));

      pill.append(text, modeSelect, removeButton);
      list.appendChild(pill);
    });
  }

  function renderSummary() {
    const summary = $("blockedSitesSummary");
    if (!summary) return;

    const softCount = draft.filter((item) => item.mode === "soft").length;
    const hardCount = draft.filter((item) => item.mode === "hard").length;
    const total = softCount + hardCount;

    if (!total) {
      summary.textContent = "No blocked sites";
      return;
    }

    summary.textContent = `${total} blocked site${total === 1 ? "" : "s"} (${softCount} soft, ${hardCount} hard)`;
  }

  function markDirty() {
    isDirty = true;
    draftTaskId = getSelectedTaskId() || draftTaskId;
  }

  function getSelectedMode() {
    return normalizeMode($("blockedSiteModeInput").value);
  }

  return {
    bindControls,
    getSites,
    hasUnsavedChangesForTask,
    loadFromTask,
    markSaved
  };
}

function mergeSites({ softBlockedSites, hardBlockedSites }) {
  const sites = new Map();

  normalizeSites(softBlockedSites).forEach((site) => {
    sites.set(site, { site, mode: "soft" });
  });

  normalizeSites(hardBlockedSites).forEach((site) => {
    sites.set(site, { site, mode: "hard" });
  });

  return [...sites.values()];
}

function normalizeSites(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(cleanSite)
    .filter(Boolean))];
}

function normalizeMode(mode) {
  return mode === "hard" ? "hard" : "soft";
}
