import {
  formatSeconds,
  getDisplaySeconds,
  getTodayDateString,
  getPeriodSeconds,
  validateSettingsInput,
  validateTaskInput
} from "../logic/utils.js";
import { initGarden, refreshGarden } from "../logic/garden/garden.js";
import {
  initBlockingUI,
  renderAnalytics
} from "../logic/blocking/blockingAnalyticsPanel.js";
import { createBlockedSiteEditor } from "./popupLogic/blockedSites.js";
import {
  escapeHtml,
  formatDateLabel,
  getBoardDates,
  getTaskDeadlineClass
} from "./popupLogic/domHelpers.js";
import { setMissionButtonVisibility } from "./popupLogic/missionControls.js";
import {
  createSettingsPanel,
  getAudioVolume
} from "./popupLogic/settingsPanel.js";

const SESSION_AUDIO_PATH = "assets/audios/end-of-session.mp3";
const AUDIO_ALERT_MAX_AGE_MS = 15000;
const STATUS_TOAST_DURATION_MS = 3600;

let state = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  sessionAlert: null,
  audioPlayedKeys: [],
  settings: {},
  garden: { plants: [], coins: 0 },
  totalFocusMinutes: 0
};

let gardenController = null;
let selectedTaskId = "";
let missionViewMode = "compact";
let timerId = null;
let statusToastTimer = null;
let refreshInFlight = false;
let refreshQueued = false;
const attemptedAudioKeys = new Set();

const $ = (id) => document.getElementById(id);
const blockedSiteEditor = createBlockedSiteEditor({
  $,
  getSelectedTaskId: () => selectedTaskId,
  getQuickAddSites: () => state.settings?.quickAddBlockedSites
});
const settingsPanel = createSettingsPanel({
  $,
  getSettings: () => state.settings,
  sendAction,
  closePanel: closeSettingsPanel,
  setStatus
});

export async function initUI() {
  bindEvents();
  $("deadlineDateInput").value = getTodayDateString();
  await refreshState();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(refreshState, 1000);
  window.addEventListener("unload", () => {
    if (timerId) clearInterval(timerId);
    if (statusToastTimer) clearTimeout(statusToastTimer);
  });
  initBlockingUI(sendMessage);
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });

  $("taskForm").addEventListener("submit", saveTask);
  $("missionForm").addEventListener("submit", saveMissionSettings);
  $("blockingForm").addEventListener("submit", saveBlockingSettings);
  $("settingsForm").addEventListener("submit", saveSettings);
  $("settingsToggleBtn").addEventListener("click", toggleSettingsPanel);
  $("settingsCloseBtn").addEventListener("click", closeSettingsPanel);
  $("settingsOverlay").addEventListener("click", (event) => {
    if (event.target === $("settingsOverlay")) closeSettingsPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("settingsOverlay").classList.contains("hidden")) {
      closeSettingsPanel();
    }
  });
  $("resetSettingsBtn").addEventListener("click", resetSettings);
  $("analyticsToggleBtn").addEventListener("click", toggleAnalyticsPanel);
  $("audioVolumeInput").addEventListener("input", settingsPanel.renderAudioVolumeValue);
  $("testAudioBtn").addEventListener("click", settingsPanel.testAudio);
  blockedSiteEditor.bindControls();
  $("cancelEditBtn").addEventListener("click", resetTaskForm);
  $("openBlockingDialogBtn").addEventListener("click", openBlockingDialog);
  $("blockingCloseBtn").addEventListener("click", () => closeBlockingDialog({ discard: true }));
  $("blockingCancelBtn").addEventListener("click", () => closeBlockingDialog({ discard: true }));
  $("collapseActiveMissionViewBtn").addEventListener("click", collapseActiveMissionView);
  $("startMissionBtn").addEventListener("click", () => {
    const taskId = getSelectedTaskId();
    if (taskId) sendAction("START_MISSION", { taskId }, "Mission started.");
  });
  $("pauseMissionBtn").addEventListener("click", () => sendAction("PAUSE_MISSION", null, "Mission paused."));
  $("resumeMissionBtn").addEventListener("click", () => sendAction("RESUME_MISSION", null, "Mission resumed."));
  $("finishWorkBtn").addEventListener("click", () => sendAction("FINISH_WORK_SESSION", null, "Work session finished."));
  $("skipRestBtn").addEventListener("click", () => sendAction("SKIP_REST", null, "Rest skipped."));
  $("resetMissionBtn").addEventListener("click", () => {
    const taskId = getSelectedTaskId();
    if (taskId) sendAction("RESET_MISSION", { taskId }, "Mission reset.");
  });
  $("viewActiveMissionBtn").addEventListener("click", viewActiveMission);
  $("completeActiveMissionBtn").addEventListener("click", () => sendAction("COMPLETE_MISSION", null, "Mission completed."));
  $("resetActiveMissionBtn").addEventListener("click", () => {
    if (state.activeMission?.taskId) {
      sendAction("RESET_MISSION", { taskId: state.activeMission.taskId }, "Active mission reset.");
    }
  });
}

async function refreshState() {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }

  refreshInFlight = true;
  const response = await sendMessage({ type: "GET_STATE" });
  refreshInFlight = false;

  if (!response.ok) {
    setStatus(response.error);
  } else {
    state = response.data;
    reconcileSelectedTask();
    void processSessionAudioAlert();
    render();
  }

  if (refreshQueued) {
    refreshQueued = false;
    refreshState();
  }
}

async function saveTask(event) {
  event.preventDefault();

  const existingTask = getSelectedTask();
  const taskId = $("taskIdInput").value;
  const payload = buildTaskPayload({
    taskId,
    title: $("taskTitleInput").value,
    fallbackTask: existingTask,
    useTaskFormDeadline: true
  });

  const validationError = getValidationError(payload);
  if (validationError) {
    setStatus(validationError);
    return;
  }

  const type = taskId ? "UPDATE_TASK" : "CREATE_TASK";
  await sendAction(type, payload, taskId ? "Task updated." : "Task created.");
  resetTaskForm();
}

async function saveMissionSettings(event) {
  event.preventDefault();
  await saveSelectedTaskSettings("Mission settings saved.");
}

async function saveBlockingSettings(event) {
  event.preventDefault();
  const saved = await saveSelectedTaskSettings("Blocking settings saved.");
  if (saved) {
    closeBlockingDialog({ discard: false });
  }
}

async function saveSelectedTaskSettings(successMessage) {
  const task = getSelectedTask();
  if (!task) {
    setStatus("Create or select a task first.");
    return false;
  }

  const payload = buildTaskPayload({
    taskId: task.id,
    title: task.title,
    fallbackTask: task,
    useTaskFormDeadline: false
  });

  const validationError = getValidationError(payload);
  if (validationError) {
    setStatus(validationError);
    return false;
  }

  const saved = await sendAction("UPDATE_TASK", payload, successMessage);
  if (saved) {
    blockedSiteEditor.markSaved(task.id);
  }
  return saved;
}

function buildTaskPayload({ taskId, title, fallbackTask, useTaskFormDeadline }) {
  const mission = fallbackTask?.mission || {};
  const useAppDefaults = !taskId;
  return {
    taskId,
    title,
    deadlineDate: useTaskFormDeadline
      ? $("deadlineDateInput")?.value || fallbackTask?.deadlineDate || getTodayDateString()
      : fallbackTask?.deadlineDate || getTodayDateString(),
    workDurationMinutes: useAppDefaults
      ? state.settings.defaultWorkMinutes
      : Number($("workDurationInput")?.value || mission.workDurationMinutes || 20),
    restDurationMinutes: useAppDefaults
      ? state.settings.defaultRestMinutes
      : Number($("restDurationInput")?.value || mission.restDurationMinutes || 3),
    totalSessions: useAppDefaults
      ? state.settings.defaultTotalSessions
      : Number($("totalSessionsInput")?.value || mission.totalSessions || 2),
    softBlockedSites: useAppDefaults ? [] : blockedSiteEditor.getSites().softBlockedSites,
    hardBlockedSites: useAppDefaults ? [] : blockedSiteEditor.getSites().hardBlockedSites,
  };
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = settingsPanel.buildPayload();

  const validationError = getSettingsValidationError(payload);
  if (validationError) {
    setStatus(validationError);
    return;
  }

  await settingsPanel.saveSettings(payload);
}

async function resetSettings() {
  await settingsPanel.resetSettings();
}

function toggleSettingsPanel() {
  const shouldOpen = $("settingsOverlay").classList.contains("hidden");
  $("settingsOverlay").classList.toggle("hidden", !shouldOpen);
  $("settingsToggleBtn").setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    settingsPanel.loadForm();
    $("settingsCloseBtn").focus();
  }
}

function openBlockingDialog() {
  resetMissionViewModeAndRender();
  const task = getSelectedTask();
  if (!task) {
    setStatus("Create or select a task first.");
    return;
  }

  blockedSiteEditor.loadFromTask(task);
  $("blockingDialog").classList.remove("hidden");
  $("openBlockingDialogBtn").setAttribute("aria-expanded", "true");
  $("blockedSiteInput").focus();
}

function closeBlockingDialog({ discard }) {
  $("blockingDialog").classList.add("hidden");
  $("openBlockingDialogBtn").setAttribute("aria-expanded", "false");

  if (discard) {
    const task = getSelectedTask();
    if (task) blockedSiteEditor.loadFromTask(task);
  }
}

function closeSettingsPanel() {
  $("settingsOverlay").classList.add("hidden");
  $("settingsToggleBtn").setAttribute("aria-expanded", "false");
  $("settingsToggleBtn").focus();
}

function toggleAnalyticsPanel() {
  const panel = $("settingsAnalyticsPanel");
  const shouldShow = panel.classList.contains("hidden");
  if (shouldShow) resetMissionViewModeAndRender();
  panel.classList.toggle("hidden", !shouldShow);
  $("analyticsToggleBtn").textContent = shouldShow ? "Hide Analytics" : "Show Analytics";
  $("analyticsToggleBtn").setAttribute("aria-expanded", String(shouldShow));
  if (shouldShow) renderAnalytics(state.blockingAnalytics);
}

async function sendAction(type, payload, successMessage) {
  const response = await sendMessage({ type, payload });

  if (!response.ok) {
    setStatus(response.error);
    return false;
  }

  state = response.data;
  reconcileSelectedTask();
  void processSessionAudioAlert();
  setStatus(successMessage);
  render();
  return true;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response || { ok: false, error: "No response from background script." });
    });
  });
}

function render() {
  renderShell();
  renderTasks();
  renderMission();
  renderGardenPlaceholder();
  if (!$("settingsAnalyticsPanel").classList.contains("hidden")) {
    renderAnalytics(state.blockingAnalytics);
  }
}

function renderShell() {
  $("coinCount").textContent = state.garden?.coins || 0;
  document.body.classList.toggle("compact-mode", state.settings?.compactMode !== false);
  document.body.classList.toggle("dark-theme", state.settings?.theme === "dark");
  if (!isEditingSettingsForm()) settingsPanel.loadForm();
}

function renderTasks() {
  const list = $("taskList");
  const tasks = (state.tasks || []).filter((task) => state.settings?.showCompletedTasks !== false || task.status !== "completed");
  $("taskCount").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  list.innerHTML = "";

  renderDateBoard(list, tasks);
}

function renderDateBoard(list, tasks) {
  const dates = getBoardDates(tasks);

  dates.forEach((date) => {
    const column = document.createElement("section");
    column.className = "date-column";
    column.dataset.deadlineDate = date;

    const title = document.createElement("div");
    title.className = "date-column-title";
    title.innerHTML = `<strong>${escapeHtml(formatDateLabel(date))}</strong><span>${escapeHtml(date)}</span>`;

    const dropZone = document.createElement("div");
    dropZone.className = "date-drop-zone";
    dropZone.dataset.deadlineDate = date;
    bindDropZone(dropZone);

    const dateTasks = tasks
      .filter((task) => task.deadlineDate === date)
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

    if (!dateTasks.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state date-empty";
      empty.textContent = "Drop tasks here";
      dropZone.appendChild(empty);
    }

    dateTasks.forEach((task) => dropZone.appendChild(createTaskCard(task)));
    column.append(title, dropZone);
    list.appendChild(column);
  });
}

function createTaskCard(task) {
  const mission = task.mission || {};
  const isSelected = task.id === selectedTaskId;
  const item = document.createElement("article");
  item.className = `task-item ${getTaskDeadlineClass(task)} ${isSelected ? "selected" : ""}`;
  item.draggable = true;
  item.dataset.taskId = task.id;

  item.innerHTML = `
    <div class="task-title-row">
      <p class="task-title">${escapeHtml(task.title)}</p>
      <span class="badge">${escapeHtml(task.status)}</span>
    </div>
    <p class="muted">${mission.totalSessions || 1} sessions, ${mission.workDurationMinutes || 20}m work, ${mission.restDurationMinutes || 3}m rest</p>
    <div class="actions task-actions ${isSelected ? "" : "hidden"}">
      <button class="primary" data-action="select">Select</button>
      <button data-action="edit">Rename</button>
      <button data-action="reset">Reset</button>
      <button class="danger" data-action="delete">Delete</button>
    </div>
  `;

  item.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    item.classList.add("dragging");
  });
  item.addEventListener("dragend", () => item.classList.remove("dragging"));
  item.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    resetMissionViewMode();
    selectedTaskId = selectedTaskId === task.id ? null : task.id;
    render();
  });

  item.querySelector('[data-action="select"]').addEventListener("click", () => {
    resetMissionViewMode();
    selectedTaskId = task.id;
    loadMissionForm(task);
    render();
    showScreen("missionScreen");
  });
  item.querySelector('[data-action="edit"]').addEventListener("click", () => editTask(task));
  item.querySelector('[data-action="reset"]').addEventListener("click", () => {
    resetMissionViewMode();
    selectedTaskId = task.id;
    sendAction("RESET_TASK", { taskId: task.id }, "Task and mission reset.");
  });
  item.querySelector('[data-action="delete"]').addEventListener("click", () => {
    sendAction("DELETE_TASK", { taskId: task.id }, "Task deleted.");
  });

  return item;
}

function bindDropZone(dropZone) {
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (event) => {
    if (!dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove("drag-over");
    }
  });
  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");

    const taskId = event.dataTransfer.getData("text/plain");
    const deadlineDate = dropZone.dataset.deadlineDate;
    if (!taskId || !deadlineDate) return;

    const task = (state.tasks || []).find((item) => item.id === taskId);
    if (!task || task.deadlineDate === deadlineDate) return;

    await sendAction("RESCHEDULE_TASK", { taskId, deadlineDate }, "Task rescheduled.");
  });
}

function renderMission() {
  if (missionViewMode === "active" && !state.activeMission) {
    resetMissionViewMode();
  }

  const selectedTask = getSelectedTask();
  const task = missionViewMode === "active" ? getActiveTask() : selectedTask;
  const hasDisplayTask = Boolean(task);
  $("missionEmpty").classList.toggle("hidden", hasDisplayTask);
  $("missionContent").classList.toggle("hidden", !hasDisplayTask);

  if (!hasDisplayTask) {
    $("selectedTaskStatus").textContent = "";
    $("collapseActiveMissionViewBtn").classList.add("hidden");
    renderActiveMissionPanel(selectedTask);
    return;
  }

  if (missionViewMode === "active" && state.activeMission?.taskId !== task.id) {
    resetMissionViewMode();
    renderMission();
    return;
  }

  const mission = getVisibleMission(task);
  const isActiveMissionView = missionViewMode === "active" && state.activeMission?.taskId === task.id;
  $("selectedTaskStatus").textContent = task.status;
  $("missionTitle").textContent = task.title;
  $("collapseActiveMissionViewBtn").classList.toggle("hidden", !isActiveMissionView);
  renderActiveMissionPanel(missionViewMode === "active" ? task : selectedTask);

  if (!isEditingMissionForm()) {
    loadMissionForm(task);
  }

  renderTimer(mission);
  renderSessionAlertNotice(mission);
  renderRewardNotice(mission);
}

function renderTimer(mission) {
  const currentWorkNumber = mission.timerMode === "completed"
    ? mission.totalSessions
    : Math.min(mission.currentSession + 1, mission.totalSessions);
  const seconds = getDisplaySeconds(mission);
  const periodSeconds = getPeriodSeconds(mission);
  const elapsed = Math.max(0, periodSeconds - seconds);
  const progress = periodSeconds > 0 ? Math.min(100, Math.round((elapsed / periodSeconds) * 100)) : 0;
  const isActiveSelected = state.activeMission?.taskId === mission.taskId;
  const hasOtherActiveMission = Boolean(state.activeMission && state.activeMission.taskId !== mission.taskId);

  $("timerModeLabel").textContent = mission.timerMode;
  $("sessionLabel").textContent = `Session ${currentWorkNumber} / ${mission.totalSessions}`;
  $("timerDisplay").textContent = formatSeconds(seconds);
  $("missionProgress").value = progress;
  $("missionMeta").textContent = `${mission.currentSession} of ${mission.totalSessions} work sessions completed.`;

  setMissionInputsDisabled(isActiveSelected && ["work", "rest", "paused"].includes(mission.timerMode));
  setMissionButtonVisibility({ $, mission });
  setButtonState("startMissionBtn", hasOtherActiveMission);
  setButtonState("pauseMissionBtn", !isActiveSelected);
  setButtonState("resumeMissionBtn", !isActiveSelected);
  setButtonState("finishWorkBtn", !isActiveSelected);
  setButtonState("skipRestBtn", !isActiveSelected);
  setButtonState("resetMissionBtn", false);
}

function renderActiveMissionPanel(selectedTask) {
  const activeMission = state.activeMission;
  const shouldShow = Boolean(activeMission && selectedTask?.id !== activeMission.taskId);
  $("activeMissionPanel").classList.toggle("hidden", !shouldShow);

  if (!shouldShow) return;

  $("activeMissionTitle").textContent = activeMission.taskTitle || getActiveTask()?.title || "Untitled task";
  $("activeMissionMode").textContent = activeMission.timerMode;
  $("activeMissionSession").textContent = `Session ${Math.min(activeMission.currentSession + 1, activeMission.totalSessions)} / ${activeMission.totalSessions}`;
  $("activeMissionRemaining").textContent = formatSeconds(getDisplaySeconds(activeMission));
  setButtonState("completeActiveMissionBtn", activeMission.timerMode === "completed" || activeMission.currentSession < activeMission.totalSessions);
}

function renderRewardNotice(mission) {
  const result = state.lastResult;
  const rewardNotice = $("rewardNotice");

  if (!result || result.taskId !== mission.taskId) {
    rewardNotice.classList.add("hidden");
    rewardNotice.textContent = "";
    return;
  }

  rewardNotice.classList.remove("hidden");
  rewardNotice.textContent = `Mission complete! You earned ${result.coinsEarned || result.seedsEarned || 0} coins.`;
}

function renderSessionAlertNotice(mission) {
  const alert = state.sessionAlert;
  const notice = $("sessionAlertNotice");

  if (!alert || alert.taskId !== mission.taskId) {
    notice.classList.add("hidden");
    notice.textContent = "";
    return;
  }

  notice.classList.remove("hidden");
  notice.textContent = alert.message;
}

async function processSessionAudioAlert() {
  const alert = state.sessionAlert;
  if (!alert?.key) return;
  if ((state.audioPlayedKeys || []).includes(alert.key) || attemptedAudioKeys.has(alert.key)) return;

  attemptedAudioKeys.add(alert.key);

  if (Date.now() - Number(alert.createdAt || 0) <= AUDIO_ALERT_MAX_AGE_MS) {
    try {
      const audio = new Audio(chrome.runtime.getURL(SESSION_AUDIO_PATH));
      audio.volume = getAudioVolume(state.settings?.audioVolume);
      await audio.play();
    } catch {
      setStatus(`${alert.message} Audio notification was blocked by the browser.`);
    }
  }

  const response = await sendMessage({ type: "ACK_SESSION_AUDIO", payload: { key: alert.key } });
  if (response.ok) {
    state = response.data;
    render();
  }
}

function renderGardenPlaceholder() {
  const gardenScreen = $("gardenScreen");

  if (gardenController === null) {
    initGardenView(gardenScreen);
  } else if (gardenController) {
    gardenController
      .refresh(state)
      .catch(err => console.warn("Failed to refresh garden:", err));
  }
}

async function initGardenView(gardenScreen) {
  if (!gardenScreen || gardenController !== null) return;
  try {
    gardenController = await initGarden(gardenScreen, state);
  } catch (error) {
    console.error('Failed to initialize garden:', error);
    gardenController = null;
  }
}

function editTask(task) {
  resetMissionViewMode();
  selectedTaskId = task.id;
  $("taskIdInput").value = task.id;
  $("taskTitleInput").value = task.title;
  $("deadlineDateInput").value = task.deadlineDate || getTodayDateString();
  $("cancelEditBtn").classList.remove("hidden");
  loadMissionForm(task);
  showScreen("tasksScreen");
  $("taskTitleInput").focus();
}

function resetTaskForm() {
  $("taskForm").reset();
  $("taskIdInput").value = "";
  $("deadlineDateInput").value = getTodayDateString();
  $("cancelEditBtn").classList.add("hidden");
}

function loadMissionForm(task) {
  const mission = task.mission || {};
  $("workDurationInput").value = mission.workDurationMinutes || 20;
  $("restDurationInput").value = mission.restDurationMinutes || 3;
  $("totalSessionsInput").value = mission.totalSessions || 2;
  blockedSiteEditor.loadFromTask(task);
}

function setMissionInputsDisabled(disabled) {
  [
    "workDurationInput",
    "restDurationInput",
    "totalSessionsInput",
    "openBlockingDialogBtn",
    "blockedSiteInput",
    "blockedSiteModeInput",
    "addBlockedSiteBtn",
    "quickAddBlockedSitesBtn",
    "saveMissionSettingsBtn",
    "saveBlockingSettingsBtn"
  ].forEach((id) => {
    const element = $(id);
    if (element) element.disabled = disabled;
  });

  document.querySelectorAll("#blockedSitesList select, #blockedSitesList button").forEach((element) => {
    element.disabled = disabled;
  });
}

function getSelectedTask() {
  return (state.tasks || []).find((task) => task.id === selectedTaskId) || null;
}

function getSelectedTaskId() {
  const task = getSelectedTask();
  if (!task) {
    setStatus("Create or select a task first.");
    return "";
  }
  return task.id;
}

function getActiveTask() {
  return (state.tasks || []).find((task) => task.id === state.activeMission?.taskId) || null;
}

function viewActiveMission() {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  missionViewMode = "active";
  loadMissionForm(activeTask);
  render();
  showScreen("missionScreen");
}

function collapseActiveMissionView() {
  resetMissionViewMode();
  render();
}

function resetMissionViewModeAndRender() {
  const didReset = resetMissionViewMode();
  $("collapseActiveMissionViewBtn").classList.add("hidden");
  if (didReset) renderMission();
}

function resetMissionViewMode() {
  if (missionViewMode !== "active") return false;

  missionViewMode = "compact";
  return true;
}

function getVisibleMission(task = getSelectedTask()) {
  if (state.activeMission?.taskId === task?.id) return state.activeMission;
  return task?.mission || null;
}

function showScreen(screenId) {
  const currentScreenId = document.querySelector(".screen.active")?.id || "";
  const shouldResetMissionView = screenId !== "missionScreen" || currentScreenId !== "missionScreen";

  if (shouldResetMissionView) {
    resetMissionViewModeAndRender();
  }

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screenId);
  });

  if (screenId === "gardenScreen") {
    const gardenScreen = $("gardenScreen");
    if (gardenScreen && gardenController === null) {
      initGardenView(gardenScreen).catch(err => console.error('Failed to initialize garden:', err));
    } else if (gardenController) {
      gardenController.refresh(state).catch(err => console.warn('Failed to refresh garden:', err));
    }
  }
}

function getValidationError(payload) {
  try {
    validateTaskInput(payload);
    return "";
  } catch (error) {
    return error.message;
  }
}

function getSettingsValidationError(payload) {
  try {
    validateSettingsInput(payload);
    return "";
  } catch (error) {
    return error.message;
  }
}

function isEditingMissionForm() {
  if (blockedSiteEditor.hasUnsavedChangesForTask(selectedTaskId)) return true;
  if (!$("blockingDialog").classList.contains("hidden")) return true;
  return [
    $("workDurationInput"),
    $("restDurationInput"),
    $("totalSessionsInput"),
    $("blockedSiteInput"),
    $("blockedSiteModeInput")
  ].includes(document.activeElement);
}

function isEditingSettingsForm() {
  return [
    $("defaultWorkMinutesInput"),
    $("defaultRestMinutesInput"),
    $("defaultTotalSessionsInput"),
    $("showCompletedTasksInput"),
    $("compactModeInput"),
    $("themeInput"),
    $("audioVolumeInput"),
    $("quickAddBlockedSitesInput"),
    $("testAudioBtn")
  ].includes(document.activeElement);
}

function setButtonState(id, disabled) {
  $(id).disabled = disabled;
}

function reconcileSelectedTask() {
  if (selectedTaskId && !(state.tasks || []).some((task) => task.id === selectedTaskId)) {
    selectedTaskId = null;
  }
}

function setStatus(message) {
  const host = $("toastHost");
  if (!host) return;

  if (statusToastTimer) {
    clearTimeout(statusToastTimer);
    statusToastTimer = null;
  }

  host.innerHTML = "";

  if (!message) {
    host.classList.remove("visible");
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  host.appendChild(toast);
  host.classList.add("visible");

  statusToastTimer = setTimeout(() => {
    host.classList.remove("visible");
    toast.classList.add("toast-exit");
    setTimeout(() => {
      if (toast.parentNode === host) {
        host.removeChild(toast);
      }
    }, 180);
    statusToastTimer = null;
  }, STATUS_TOAST_DURATION_MS);
}

initUI();
