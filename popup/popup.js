let state = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  garden: { seeds: 0 }
};

let timerId = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await refreshState();
  timerId = setInterval(refreshState, 1000);
});

window.addEventListener("unload", () => {
  if (timerId) clearInterval(timerId);
});

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });

  $("taskForm").addEventListener("submit", saveTask);
  $("cancelEditBtn").addEventListener("click", resetTaskForm);
  $("finishMissionBtn").addEventListener("click", () => sendAction("FINISH_MISSION", null, "Mission finished."));
  $("abandonMissionBtn").addEventListener("click", () => sendAction("ABANDON_MISSION", null, "Mission abandoned."));
}

async function refreshState() {
  const response = await sendMessage({ type: "GET_STATE" });
  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  state = response.data;
  render();
}

async function saveTask(event) {
  event.preventDefault();

  const taskId = $("taskIdInput").value;
  const payload = {
    taskId,
    title: $("taskTitleInput").value,
    durationMinutes: Number($("taskDurationInput").value)
  };

  const type = taskId ? "UPDATE_TASK" : "CREATE_TASK";
  await sendAction(type, payload, taskId ? "Task updated." : "Task created.");
  resetTaskForm();
}

async function sendAction(type, payload, successMessage) {
  const response = await sendMessage({ type, payload });

  if (!response.ok) {
    setStatus(response.error);
    return;
  }

  state = response.data;
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
  renderResult();
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
    const item = document.createElement("article");
    item.className = "task-item";

    const startDisabled = state.activeMission?.status === "running" || task.status === "completed";

    item.innerHTML = `
      <div class="task-title-row">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <span class="badge">${escapeHtml(task.status)}</span>
      </div>
      <p class="muted">${task.durationMinutes} minute mission</p>
      <div class="actions">
        <button class="primary" data-action="start" ${startDisabled ? "disabled" : ""}>Start</button>
        <button data-action="edit">Edit</button>
        <button class="danger" data-action="delete">Delete</button>
      </div>
    `;

    item.querySelector('[data-action="start"]').addEventListener("click", () => {
      sendAction("START_MISSION", { taskId: task.id }, "Mission started.");
      showScreen("missionScreen");
    });
    item.querySelector('[data-action="edit"]').addEventListener("click", () => editTask(task));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => {
      sendAction("DELETE_TASK", { taskId: task.id }, "Task deleted.");
    });

    list.appendChild(item);
  });
}

function renderMission() {
  const mission = state.activeMission;
  const hasMission = mission?.status === "running";

  $("missionEmpty").classList.toggle("hidden", hasMission);
  $("missionActive").classList.toggle("hidden", !hasMission);

  if (!hasMission) return;

  const totalMs = mission.durationMinutes * 60 * 1000;
  const elapsedMs = Math.max(0, Date.now() - mission.startTime);
  const remainingMs = Math.max(0, mission.endTime - Date.now());
  const progress = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  $("missionTitle").textContent = mission.taskTitle;
  $("timerDisplay").textContent = formatTime(remainingMs);
  $("missionProgress").value = progress;
  $("missionMeta").textContent = `${progress}% complete. Blocked-sites logic is stubbed.`;
}

function renderResult() {
  const result = state.lastResult;
  const target = $("resultContent");

  if (!result) {
    target.className = "empty-state";
    target.textContent = "No mission result yet.";
    return;
  }

  target.className = "";
  target.innerHTML = `
    <p><strong>${result.completed ? "Mission complete" : "Mission abandoned"}</strong></p>
    <p>${escapeHtml(result.taskTitle)}</p>
    <div class="result-grid">
      <div class="result-stat"><span>Seeds</span><strong>${result.seedsEarned}</strong></div>
      <div class="result-stat"><span>Score</span><strong>${result.focusScore}</strong></div>
      <div class="result-stat"><span>Duration</span><strong>${result.durationMinutes}m</strong></div>
      <div class="result-stat"><span>Garden</span><strong>Stub</strong></div>
    </div>
  `;
}

function renderGardenPlaceholder() {
  const seeds = state.garden?.seeds || 0;
  $("gardenSeeds").textContent = `${seeds} ${seeds === 1 ? "seed" : "seeds"}`;
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screenId);
  });
}

function editTask(task) {
  $("taskIdInput").value = task.id;
  $("taskTitleInput").value = task.title;
  $("taskDurationInput").value = task.durationMinutes;
  $("cancelEditBtn").classList.remove("hidden");
  $("taskTitleInput").focus();
}

function resetTaskForm() {
  $("taskForm").reset();
  $("taskIdInput").value = "";
  $("taskDurationInput").value = "25";
  $("cancelEditBtn").classList.add("hidden");
}

function setStatus(message) {
  $("statusMessage").textContent = message || "";
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
