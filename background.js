const STORAGE_KEYS = {
  tasks: "tasks",
  activeMission: "activeMission",
  lastResult: "lastResult",
  garden: "garden"
};

const DEFAULT_STATE = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  garden: {
    seeds: 0,
    placeholderNote: "Garden visuals are intentionally stubbed for the MVP."
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  await ensureState();
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureState();
  await completeExpiredMissionIfNeeded();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "missionTick") {
    await completeExpiredMissionIfNeeded();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function handleMessage(message) {
  const type = message?.type;

  if (type === "GET_STATE") return getState();
  if (type === "CREATE_TASK") return createTask(message.payload);
  if (type === "UPDATE_TASK") return updateTask(message.payload);
  if (type === "DELETE_TASK") return deleteTask(message.payload?.taskId);
  if (type === "START_MISSION") return startMission(message.payload?.taskId);
  if (type === "FINISH_MISSION") return finishMission("completed");
  if (type === "ABANDON_MISSION") return finishMission("abandoned");
  if (type === "CLEAR_RESULT") return clearResult();

  throw new Error(`Unknown message type: ${type}`);
}

async function ensureState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  const nextState = {
    tasks: Array.isArray(stored.tasks) ? stored.tasks : DEFAULT_STATE.tasks,
    activeMission: stored.activeMission || DEFAULT_STATE.activeMission,
    lastResult: stored.lastResult || DEFAULT_STATE.lastResult,
    garden: {
      ...DEFAULT_STATE.garden,
      ...(stored.garden || {})
    }
  };

  await chrome.storage.local.set(nextState);
  return nextState;
}

async function getState() {
  await completeExpiredMissionIfNeeded();
  return chrome.storage.local.get(DEFAULT_STATE);
}

async function createTask(payload = {}) {
  const title = String(payload.title || "").trim();
  const durationMinutes = Number(payload.durationMinutes || 25);

  if (!title) throw new Error("Task title is required.");
  if (![25, 45, 60].includes(durationMinutes)) {
    throw new Error("Duration must be 25, 45, or 60 minutes.");
  }

  const state = await ensureState();
  const task = {
    id: makeId("task"),
    title,
    durationMinutes,
    status: "planned",
    createdAt: Date.now(),
    blockedSitesPlaceholder: []
  };

  state.tasks.push(task);
  await chrome.storage.local.set({ tasks: state.tasks });
  return getState();
}

async function updateTask(payload = {}) {
  const taskId = payload.taskId;
  const title = String(payload.title || "").trim();
  const durationMinutes = Number(payload.durationMinutes || 25);

  if (!taskId) throw new Error("Task id is required.");
  if (!title) throw new Error("Task title is required.");

  const state = await ensureState();
  const hasActiveMissionForTask = state.activeMission?.taskId === taskId;

  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      title,
      durationMinutes: hasActiveMissionForTask ? task.durationMinutes : durationMinutes
    };
  });

  await chrome.storage.local.set({ tasks: state.tasks });
  return getState();
}

async function deleteTask(taskId) {
  if (!taskId) throw new Error("Task id is required.");

  const state = await ensureState();
  if (state.activeMission?.taskId === taskId) {
    throw new Error("Finish or abandon the active mission before deleting this task.");
  }

  const tasks = state.tasks.filter((task) => task.id !== taskId);
  await chrome.storage.local.set({ tasks });
  return getState();
}

async function startMission(taskId) {
  if (!taskId) throw new Error("Task id is required.");

  const state = await ensureState();
  if (state.activeMission?.status === "running") {
    throw new Error("A mission is already running.");
  }

  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found.");

  const now = Date.now();
  const mission = {
    id: makeId("mission"),
    taskId: task.id,
    taskTitle: task.title,
    durationMinutes: task.durationMinutes,
    startTime: now,
    endTime: now + task.durationMinutes * 60 * 1000,
    status: "running",
    progressNote: "Blocked-sites tracking is a placeholder in this MVP."
  };

  const tasks = state.tasks.map((item) => {
    if (item.id !== task.id) return item;
    return { ...item, status: "in_mission" };
  });

  await chrome.storage.local.set({ tasks, activeMission: mission, lastResult: null });
  chrome.alarms.create("missionTick", { periodInMinutes: 1 });
  return getState();
}

async function completeExpiredMissionIfNeeded() {
  const state = await chrome.storage.local.get(DEFAULT_STATE);
  const mission = state.activeMission;

  if (!mission || mission.status !== "running") return state;
  if (Date.now() < mission.endTime) return state;

  return finishMission("completed", { autoCompleted: true });
}

async function finishMission(outcome, options = {}) {
  const state = await ensureState();
  const mission = state.activeMission;

  if (!mission || mission.status !== "running") {
    throw new Error("There is no active mission.");
  }

  const completed = outcome === "completed";
  const reward = calculateReward(mission.durationMinutes, completed);
  const result = {
    id: makeId("result"),
    missionId: mission.id,
    taskId: mission.taskId,
    taskTitle: mission.taskTitle,
    outcome,
    completed,
    autoCompleted: Boolean(options.autoCompleted),
    durationMinutes: mission.durationMinutes,
    seedsEarned: reward.seedsEarned,
    focusScore: reward.focusScore,
    completedAt: Date.now(),
    note: "Rewards are active; garden visuals are still placeholders."
  };

  const tasks = state.tasks.map((task) => {
    if (task.id !== mission.taskId) return task;
    return { ...task, status: completed ? "completed" : "abandoned" };
  });

  const garden = {
    ...DEFAULT_STATE.garden,
    ...(state.garden || {}),
    seeds: Math.max(0, Number(state.garden?.seeds || 0) + reward.seedsEarned)
  };

  await chrome.storage.local.set({
    tasks,
    activeMission: null,
    lastResult: result,
    garden
  });
  chrome.alarms.clear("missionTick");

  return getState();
}

async function clearResult() {
  await chrome.storage.local.set({ lastResult: null });
  return getState();
}

function calculateReward(durationMinutes, completed) {
  if (!completed) {
    return { seedsEarned: 0, focusScore: 60 };
  }

  return {
    seedsEarned: Math.round(durationMinutes * 0.8) + 10,
    focusScore: 100
  };
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
