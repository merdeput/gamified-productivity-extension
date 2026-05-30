import {
  formatSeconds,
  getDisplaySeconds,
  getPeriodSeconds,
  validateTaskInput
} from "../state.js";

let state = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  garden: { seeds: 0 }
};

let selectedTaskId = "";
let timerId = null;
let refreshInFlight = false;
let refreshQueued = false;

const $ = (id) => document.getElementById(id);

export async function initUI() {
  bindEvents();
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

  document.querySelectorAll("[data-work-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      $("workDurationInput").value = button.dataset.workPreset;
    });
  });

  $("taskForm").addEventListener("submit", saveTask);
  $("missionForm").addEventListener("submit", saveMissionSettings);
  $("cancelEditBtn").addEventListener("click", resetTaskForm);
  $("startMissionBtn").addEventListener("click", () => {
    const taskId = getSelectedTaskId();
    if (taskId) sendAction("START_MISSION", { taskId }, "Mission started.");
  });
  $("pauseMissionBtn").addEventListener("click", () => sendAction("PAUSE_MISSION", null, "Mission paused."));
  $("resumeMissionBtn").addEventListener("click", () => sendAction("RESUME_MISSION", null, "Mission resumed."));
  $("finishWorkBtn").addEventListener("click", () => sendAction("FINISH_WORK_SESSION", null, "Work session finished."));
  $("skipRestBtn").addEventListener("click", () => sendAction("SKIP_REST", null, "Rest skipped."));
  $("completeMissionBtn").addEventListener("click", () => sendAction("COMPLETE_MISSION", null, "Mission completed."));
  $("resetMissionBtn").addEventListener("click", () => {
    const taskId = getSelectedTaskId();
    if (taskId) sendAction("RESET_MISSION", { taskId }, "Mission reset.");
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
    fallbackTask: existingTask
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
    fallbackTask: task
  });

  const validationError = getValidationError(payload);
  if (validationError) {
    setStatus(validationError);
    return;
  }

  await sendAction("UPDATE_TASK", payload, "Mission settings saved.");
}

function buildTaskPayload({ taskId, title, fallbackTask }) {
  const mission = fallbackTask?.mission || {};
  return {
    taskId,
    title,
    workDurationMinutes: Number($("workDurationInput")?.value || mission.workDurationMinutes || 25),
    restDurationMinutes: Number($("restDurationInput")?.value || mission.restDurationMinutes || 5),
    totalSessions: Number($("totalSessionsInput")?.value || mission.totalSessions || 4),
    softBlockedSites: parseSiteText($("softBlockedSitesInput")?.value || fallbackTask?.softBlockedSites?.join(", ") || ""),
    hardBlockedSites: parseSiteText($("hardBlockedSitesInput")?.value || fallbackTask?.hardBlockedSites?.join(", ") || "")
  };
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
}

function renderTasks() {
  const list = $("taskList");
  const tasks = state.tasks || [];
  $("taskCount").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  list.innerHTML = "";

  if (tasks.length === 0) {
    list.innerHTML = `<div class="empty-state">No tasks yet. Create one to start the MVP loop.</div>`;
    return;
  }

  tasks.forEach((task) => {
    const mission = task.mission || {};
    const item = document.createElement("article");
    item.className = `task-item ${task.id === selectedTaskId ? "selected" : ""}`;

    item.innerHTML = `
      <div class="task-title-row">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <span class="badge">${escapeHtml(task.status)}</span>
      </div>
      <p class="muted">${mission.totalSessions || 1} sessions, ${mission.workDurationMinutes || 25}m work, ${mission.restDurationMinutes || 5}m rest</p>
      <div class="actions">
        <button class="primary" data-action="select">Select</button>
        <button data-action="edit">Rename</button>
        <button data-action="reset">Reset</button>
        <button class="danger" data-action="delete">Delete</button>
      </div>
    `;

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

    list.appendChild(item);
  });
}

function renderMission() {
  const task = getSelectedTask();
  const hasTask = Boolean(task);
  $("missionEmpty").classList.toggle("hidden", hasTask);
  $("missionContent").classList.toggle("hidden", !hasTask);

  if (!hasTask) {
    $("selectedTaskStatus").textContent = "No task";
    return;
  }

  const mission = getVisibleMission();
  $("selectedTaskStatus").textContent = task.status;
  $("missionTitle").textContent = task.title;

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

  $("timerModeLabel").textContent = mission.timerMode;
  $("sessionLabel").textContent = `Session ${currentWorkNumber} / ${mission.totalSessions}`;
  $("timerDisplay").textContent = formatSeconds(seconds);
  $("missionProgress").value = progress;
  $("missionMeta").textContent = `${mission.currentSession} of ${mission.totalSessions} work sessions completed.`;

  setMissionInputsDisabled(isActiveSelected && ["work", "rest", "paused"].includes(mission.timerMode));
  setButtonState("startMissionBtn", isActiveSelected || mission.timerMode === "completed");
  setButtonState("pauseMissionBtn", !isActiveSelected || !["work", "rest"].includes(mission.timerMode));
  setButtonState("resumeMissionBtn", !isActiveSelected || mission.timerMode !== "paused");
  setButtonState("finishWorkBtn", !isActiveSelected || !(mission.timerMode === "work" || mission.previousTimerMode === "work"));
  setButtonState("skipRestBtn", !isActiveSelected || !(mission.timerMode === "rest" || mission.previousTimerMode === "rest"));
  setButtonState("completeMissionBtn", !isActiveSelected || mission.timerMode === "completed" || mission.currentSession < mission.totalSessions);
  setButtonState("resetMissionBtn", false);
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
  $("cancelEditBtn").classList.remove("hidden");
  loadMissionForm(task);
  showScreen("tasksScreen");
  $("taskTitleInput").focus();
}

function resetTaskForm() {
  $("taskForm").reset();
  $("taskIdInput").value = "";
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
