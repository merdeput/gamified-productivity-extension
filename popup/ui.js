import {
  formatSeconds,
  getDisplaySeconds,
  getTodayDateString,
  getPeriodSeconds,
  formatLocalDate,
  validateSettingsInput,
  validateTaskInput
} from "../utils.js";

let state = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  settings: {},
  garden: { seeds: 0 }
};

let selectedTaskId = "";
let timerId = null;
let refreshInFlight = false;
let refreshQueued = false;

const $ = (id) => document.getElementById(id);

export async function initUI() {
  bindEvents();
  $("deadlineDateInput").value = getTodayDateString();
  await refreshState();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(refreshState, 1000);
  window.addEventListener("unload", () => {
    if (timerId) clearInterval(timerId);
  });
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });

  $("taskForm").addEventListener("submit", saveTask);
  $("missionForm").addEventListener("submit", saveMissionSettings);
  $("settingsForm").addEventListener("submit", saveSettings);
  $("settingsToggleBtn").addEventListener("click", toggleSettingsPanel);
  $("settingsCloseBtn").addEventListener("click", closeSettingsPanel);
  $("resetSettingsBtn").addEventListener("click", resetSettings);
  $("cancelEditBtn").addEventListener("click", resetTaskForm);
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
    if (!selectedTaskId && state.tasks?.length) selectedTaskId = state.activeMission?.taskId || state.tasks[0].id;
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
  const task = getSelectedTask();
  if (!task) {
    setStatus("Create or select a task first.");
    return;
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
    return;
  }

  await sendAction("UPDATE_TASK", payload, "Mission settings saved.");
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
      : Number($("workDurationInput")?.value || mission.workDurationMinutes || 25),
    restDurationMinutes: useAppDefaults
      ? state.settings.defaultRestMinutes
      : Number($("restDurationInput")?.value || mission.restDurationMinutes || 5),
    totalSessions: useAppDefaults
      ? state.settings.defaultTotalSessions
      : Number($("totalSessionsInput")?.value || mission.totalSessions || 4),
    softBlockedSites: useAppDefaults ? [] : parseSiteText($("softBlockedSitesInput")?.value || fallbackTask?.softBlockedSites?.join(", ") || ""),
    hardBlockedSites: useAppDefaults ? [] : parseSiteText($("hardBlockedSitesInput")?.value || fallbackTask?.hardBlockedSites?.join(", ") || "")
  };
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = {
    defaultWorkMinutes: Number($("defaultWorkMinutesInput").value),
    defaultRestMinutes: Number($("defaultRestMinutesInput").value),
    defaultTotalSessions: Number($("defaultTotalSessionsInput").value),
    showCompletedTasks: $("showCompletedTasksInput").checked,
    compactMode: $("compactModeInput").checked,
    theme: $("themeInput").value
  };

  const validationError = getSettingsValidationError(payload);
  if (validationError) {
    setStatus(validationError);
    return;
  }

  await sendAction("UPDATE_SETTINGS", payload, "Settings saved.");
}

async function resetSettings() {
  await sendAction("RESET_SETTINGS", null, "Settings reset to defaults.");
}

function toggleSettingsPanel() {
  const shouldOpen = $("settingsPanel").classList.contains("hidden");
  $("settingsPanel").classList.toggle("hidden", !shouldOpen);
  $("settingsToggleBtn").setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) loadSettingsForm();
}

function closeSettingsPanel() {
  $("settingsPanel").classList.add("hidden");
  $("settingsToggleBtn").setAttribute("aria-expanded", "false");
}

async function sendAction(type, payload, successMessage) {
  const response = await sendMessage({ type, payload });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  state = response.data;
  if (payload?.taskId) selectedTaskId = payload.taskId;
  if (state.activeMission?.taskId) selectedTaskId = state.activeMission.taskId;
  setStatus(successMessage);
  render();
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
}

function renderShell() {
  $("seedCount").textContent = state.garden?.seeds || 0;
  document.body.classList.toggle("compact-mode", state.settings?.compactMode !== false);
  document.body.classList.toggle("dark-theme", state.settings?.theme === "dark");
  if (!isEditingSettingsForm()) loadSettingsForm();
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
  item.className = `task-item ${isSelected ? "selected" : ""}`;
  item.draggable = true;
  item.dataset.taskId = task.id;

  item.innerHTML = `
    <div class="task-title-row">
      <p class="task-title">${escapeHtml(task.title)}</p>
      <span class="badge">${escapeHtml(task.status)}</span>
    </div>
    <p class="muted">${mission.totalSessions || 1} sessions, ${mission.workDurationMinutes || 25}m work, ${mission.restDurationMinutes || 5}m rest</p>
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
    selectedTaskId = selectedTaskId === task.id ? "" : task.id;
    render();
  });

  item.querySelector('[data-action="select"]').addEventListener("click", () => {
    selectedTaskId = task.id;
    loadMissionForm(task);
    render();
    showScreen("missionScreen");
  });
  item.querySelector('[data-action="edit"]').addEventListener("click", () => editTask(task));
  item.querySelector('[data-action="reset"]').addEventListener("click", () => {
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
  const task = getSelectedTask();
  const hasTask = Boolean(task);
  $("missionEmpty").classList.toggle("hidden", hasTask);
  $("missionContent").classList.toggle("hidden", !hasTask);

  if (!hasTask) {
    $("selectedTaskStatus").textContent = "No task";
    renderActiveMissionPanel(null);
    return;
  }

  const mission = getVisibleMission();
  $("selectedTaskStatus").textContent = task.status;
  $("missionTitle").textContent = task.title;
  renderActiveMissionPanel(task);

  if (!isEditingMissionForm()) {
    loadMissionForm(task);
  }

  renderTimer(mission);
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
  setButtonState("startMissionBtn", isActiveSelected || hasOtherActiveMission || mission.timerMode === "completed");
  setButtonState("pauseMissionBtn", !isActiveSelected || !["work", "rest"].includes(mission.timerMode));
  setButtonState("resumeMissionBtn", !isActiveSelected || mission.timerMode !== "paused");
  setButtonState("finishWorkBtn", !isActiveSelected || !(mission.timerMode === "work" || mission.previousTimerMode === "work"));
  setButtonState("skipRestBtn", !isActiveSelected || !(mission.timerMode === "rest" || mission.previousTimerMode === "rest"));
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
  rewardNotice.textContent = `Mission complete! You earned ${result.seedsEarned} garden points.`;
}

function renderGardenPlaceholder() {
  const seeds = state.garden?.seeds || 0;
  $("gardenSeeds").textContent = `${seeds} ${seeds === 1 ? "seed" : "seeds"}`;
}

function editTask(task) {
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
  $("workDurationInput").value = mission.workDurationMinutes || 25;
  $("restDurationInput").value = mission.restDurationMinutes || 5;
  $("totalSessionsInput").value = mission.totalSessions || 4;
  $("softBlockedSitesInput").value = (task.softBlockedSites || mission.softBlockedSites || []).join(", ");
  $("hardBlockedSitesInput").value = (task.hardBlockedSites || mission.hardBlockedSites || []).join(", ");
}

function loadSettingsForm() {
  const settings = state.settings || {};
  $("defaultWorkMinutesInput").value = settings.defaultWorkMinutes ?? 25;
  $("defaultRestMinutesInput").value = settings.defaultRestMinutes ?? 5;
  $("defaultTotalSessionsInput").value = settings.defaultTotalSessions ?? 4;
  $("showCompletedTasksInput").checked = settings.showCompletedTasks !== false;
  $("compactModeInput").checked = settings.compactMode !== false;
  $("themeInput").value = settings.theme === "dark" ? "dark" : "light";
}

function getBoardDates(tasks) {
  const dates = new Set();
  const today = parseLocalDate(getTodayDateString());

  for (let offset = 0; offset < 5; offset += 1) {
    dates.add(formatLocalDate(addDays(today, offset)));
  }

  tasks.forEach((task) => dates.add(task.deadlineDate || getTodayDateString()));
  return [...dates].sort();
}

function formatDateLabel(dateString) {
  const today = parseLocalDate(getTodayDateString());
  const date = parseLocalDate(dateString);
  const diffDays = Math.round((date - today) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function setMissionInputsDisabled(disabled) {
  ["workDurationInput", "restDurationInput", "totalSessionsInput", "softBlockedSitesInput", "hardBlockedSitesInput", "saveMissionSettingsBtn"].forEach((id) => {
    $(id).disabled = disabled;
  });
}

function getSelectedTask() {
  return (state.tasks || []).find((task) => task.id === selectedTaskId) || state.tasks?.[0] || null;
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

  selectedTaskId = activeTask.id;
  loadMissionForm(activeTask);
  render();
  showScreen("missionScreen");
}

function getVisibleMission() {
  const task = getSelectedTask();
  if (state.activeMission?.taskId === task?.id) return state.activeMission;
  return task?.mission || null;
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screenId);
  });
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

function parseSiteText(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((site) => site.trim())
    .filter(Boolean);
}

function isEditingMissionForm() {
  return [
    $("workDurationInput"),
    $("restDurationInput"),
    $("totalSessionsInput"),
    $("softBlockedSitesInput"),
    $("hardBlockedSitesInput")
  ].includes(document.activeElement);
}

function isEditingSettingsForm() {
  return [
    $("defaultWorkMinutesInput"),
    $("defaultRestMinutesInput"),
    $("defaultTotalSessionsInput"),
    $("showCompletedTasksInput"),
    $("compactModeInput"),
    $("themeInput")
  ].includes(document.activeElement);
}

function setButtonState(id, disabled) {
  $(id).disabled = disabled;
}

function setStatus(message) {
  $("statusMessage").textContent = message || "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
