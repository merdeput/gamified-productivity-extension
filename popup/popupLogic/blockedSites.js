import { cleanSite } from "../../logic/utils.js";

const COMMON_BLOCKED_SITES = ["youtube.com", "facebook.com", "instagram.com", "x.com", "reddit.com"];

export function createBlockedSiteEditor({ $, getSelectedTaskId }) {
  let draft = {
    softBlockedSites: [],
    hardBlockedSites: []
  };
  let draftTaskId = "";
  let isDirty = false;

  function bindControls() {
    bindInput("soft", "softBlockedSiteInput");
    bindInput("hard", "hardBlockedSiteInput");
    $("quickAddSoftSitesBtn").addEventListener("click", () => addCommonSites("soft"));
    $("quickAddHardSitesBtn").addEventListener("click", () => addCommonSites("hard"));
  }

  function bindInput(mode, inputId) {
    const input = $(inputId);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addSite(mode, input.value);
      input.value = "";
    });
  }

  function loadFromTask(task) {
    const mission = task.mission || {};
    draft = {
      softBlockedSites: normalizeSites(task.softBlockedSites || mission.softBlockedSites || []),
      hardBlockedSites: normalizeSites(task.hardBlockedSites || mission.hardBlockedSites || [])
    };
    draftTaskId = task.id;
    isDirty = false;
    $("softBlockedSiteInput").value = "";
    $("hardBlockedSiteInput").value = "";
    render();
  }

  function getSites() {
    return {
      softBlockedSites: [...draft.softBlockedSites],
      hardBlockedSites: [...draft.hardBlockedSites]
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
    const listKey = getListKey(mode);
    const site = cleanSite(value);
    if (!site || draft[listKey].includes(site)) return false;
    draft[listKey] = [...draft[listKey], site];
    markDirty();
    if (shouldRender) render();
    return true;
  }

  function removeSite(mode, site) {
    const listKey = getListKey(mode);
    const nextSites = draft[listKey].filter((item) => item !== site);
    if (nextSites.length === draft[listKey].length) return;
    draft[listKey] = nextSites;
    markDirty();
    render();
  }

  function render() {
    renderList("soft", "softBlockedSitesList");
    renderList("hard", "hardBlockedSitesList");
  }

  function renderList(mode, listId) {
    const list = $(listId);
    const sites = draft[getListKey(mode)];
    list.innerHTML = "";

    if (!sites.length) {
      const empty = document.createElement("span");
      empty.className = "blocked-site-empty";
      empty.textContent = "No sites";
      list.appendChild(empty);
      return;
    }

    sites.forEach((site) => {
      const pill = document.createElement("span");
      pill.className = "blocked-site-pill";

      const text = document.createElement("span");
      text.textContent = site;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "blocked-site-remove";
      removeButton.setAttribute("aria-label", `Remove ${site}`);
      removeButton.textContent = "X";
      removeButton.addEventListener("click", () => removeSite(mode, site));

      pill.append(text, removeButton);
      list.appendChild(pill);
    });
  }

  function markDirty() {
    isDirty = true;
    draftTaskId = getSelectedTaskId() || draftTaskId;
  }

  return {
    bindControls,
    getSites,
    hasUnsavedChangesForTask,
    loadFromTask,
    markSaved
  };
}

function normalizeSites(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(cleanSite)
    .filter(Boolean))];
}

function getListKey(mode) {
  return mode === "hard" ? "hardBlockedSites" : "softBlockedSites";
}
