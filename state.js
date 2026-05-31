export const DEFAULT_SETTINGS = {
  defaultWorkMinutes: 25,
  defaultRestMinutes: 5,
  defaultTotalSessions: 4,
  showCompletedTasks: true,
  compactMode: true
};

export const DEFAULT_STATE = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  settings: { ...DEFAULT_SETTINGS },
  garden: {
    seeds: 0,
    placeholderNote: "Garden visuals are intentionally stubbed for the MVP."
  }
};

export const RUNNING_MODES = ["work", "rest"];
export const TIMER_MODES = ["idle", "work", "rest", "paused", "completed"];

export function normalizeState(stored = {}) {
  const tasks = Array.isArray(stored.tasks) ? stored.tasks.map(normalizeTask) : [];
  const activeMission = stored.activeMission ? normalizeMission(stored.activeMission, null) : null;

  return {
    tasks,
    activeMission,
    lastResult: stored.lastResult || null,
    settings: normalizeSettings(stored.settings),
    garden: {
      ...DEFAULT_STATE.garden,
      ...(stored.garden || {})
    }
  };
}

export function createTask(state, payload) {
  const taskInput = validateTaskInput(payload, state.settings);
  const now = Date.now();
  const task = {
    id: makeId("task"),
    title: taskInput.title,
    deadlineDate: taskInput.deadlineDate,
    status: "active",
    createdAt: now,
    updatedAt: now,
    softBlockedSites: taskInput.softBlockedSites,
    hardBlockedSites: taskInput.hardBlockedSites,
    mission: createMission({
      taskId: null,
      taskTitle: taskInput.title,
      totalSessions: taskInput.totalSessions,
      workDurationMinutes: taskInput.workDurationMinutes,
      restDurationMinutes: taskInput.restDurationMinutes,
      softBlockedSites: taskInput.softBlockedSites,
      hardBlockedSites: taskInput.hardBlockedSites
    })
  };

  task.mission.taskId = task.id;
  return withState({ ...state, tasks: [...state.tasks, task] });
}

export function updateTask(state, payload) {
  const taskId = payload.taskId;
  if (!taskId) throw new Error("Task id is required.");

  const taskInput = validateTaskInput(payload);
  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing) throw new Error("Task not found.");

  if (state.activeMission?.taskId === taskId && RUNNING_MODES.includes(state.activeMission.timerMode)) {
    throw new Error("Pause or reset the active mission before editing this task.");
  }

  const mission = normalizeMission(existing.mission, existing);
  const editableMission = {
    ...mission,
    taskTitle: taskInput.title,
    totalSessions: taskInput.totalSessions,
    workDurationMinutes: taskInput.workDurationMinutes,
    restDurationMinutes: taskInput.restDurationMinutes,
    remainingSeconds: mission.timerMode === "idle" ? minutesToSeconds(taskInput.workDurationMinutes) : mission.remainingSeconds,
    softBlockedSites: taskInput.softBlockedSites,
    hardBlockedSites: taskInput.hardBlockedSites
  };

  const tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      title: taskInput.title,
      deadlineDate: taskInput.deadlineDate,
      status: task.status === "completed" ? "completed" : "active",
      updatedAt: Date.now(),
      softBlockedSites: taskInput.softBlockedSites,
      hardBlockedSites: taskInput.hardBlockedSites,
      mission: editableMission
    };
  });

  return withState({
    ...state,
    tasks,
    activeMission: state.activeMission?.taskId === taskId ? editableMission : state.activeMission
  });
}

export function rescheduleTask(state, payload) {
  const taskId = payload?.taskId;
  if (!taskId) throw new Error("Task id is required.");

  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing) throw new Error("Task not found.");

  const deadlineDate = normalizeDateString(payload.deadlineDate);
  const tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      deadlineDate,
      updatedAt: Date.now()
    };
  });

  return withState({ ...state, tasks });
}

export function deleteTask(state, taskId) {
  if (!taskId) throw new Error("Task id is required.");
  if (state.activeMission?.taskId === taskId) {
    throw new Error("Reset the active mission before deleting this task.");
  }

  return withState({
    ...state,
    tasks: state.tasks.filter((task) => task.id !== taskId)
  });
}

export function startMission(state, taskId) {
  if (!taskId) throw new Error("Task id is required.");
  if (state.activeMission && state.activeMission.taskId !== taskId) {
    throw new Error("Reset or complete the current mission before starting another task.");
  }

  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found.");

  const mission = normalizeMission(task.mission, task);
  if (mission.timerMode === "completed") {
    throw new Error("Reset this mission before starting it again.");
  }

  return withState(
    saveMission(state, taskId, {
      ...mission,
      status: "running",
      timerMode: "work",
      previousTimerMode: null,
      remainingSeconds: mission.remainingSeconds > 0 ? mission.remainingSeconds : minutesToSeconds(mission.workDurationMinutes),
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function pauseMission(state) {
  const mission = getActiveMissionOrThrow(state);
  if (!RUNNING_MODES.includes(mission.timerMode)) {
    throw new Error("Only a running work or rest timer can be paused.");
  }

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      timerMode: "paused",
      previousTimerMode: mission.timerMode,
      remainingSeconds: getRemainingSeconds(mission),
      startedAt: null
    }, "active"),
    "clear"
  );
}

export function resumeMission(state) {
  const mission = getActiveMissionOrThrow(state);
  if (mission.timerMode !== "paused") throw new Error("Mission is not paused.");

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      timerMode: mission.previousTimerMode || "work",
      previousTimerMode: null,
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function finishWorkSession(state) {
  const mission = getActiveMissionOrThrow(state);
  if (mission.timerMode !== "work" && !(mission.timerMode === "paused" && mission.previousTimerMode === "work")) {
    throw new Error("There is no work session to finish.");
  }

  const completedSessions = mission.currentSession + 1;
  if (completedSessions >= mission.totalSessions) {
    return completeMission(state, { missionOverride: { ...mission, currentSession: completedSessions } });
  }

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      currentSession: completedSessions,
      timerMode: "rest",
      previousTimerMode: null,
      remainingSeconds: minutesToSeconds(mission.restDurationMinutes),
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function takeRest(state) {
  const mission = getActiveMissionOrThrow(state);
  if (mission.currentSession <= 0 || mission.currentSession >= mission.totalSessions) {
    throw new Error("Rest is only available between work sessions.");
  }

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      status: "running",
      timerMode: "rest",
      previousTimerMode: null,
      remainingSeconds: minutesToSeconds(mission.restDurationMinutes),
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function skipRest(state) {
  const mission = getActiveMissionOrThrow(state);
  if (mission.timerMode !== "rest" && !(mission.timerMode === "paused" && mission.previousTimerMode === "rest")) {
    throw new Error("There is no rest period to skip.");
  }

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      timerMode: "work",
      previousTimerMode: null,
      remainingSeconds: minutesToSeconds(mission.workDurationMinutes),
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function resetMission(state, taskId) {
  if (!taskId) throw new Error("Task id is required.");

  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found.");

  const currentMission = normalizeMission(task.mission, task);
  const mission = {
    ...currentMission,
    status: "not_started",
    timerMode: "idle",
    previousTimerMode: null,
    currentSession: 0,
    remainingSeconds: minutesToSeconds(currentMission.workDurationMinutes),
    startedAt: null,
    completedAt: null,
    rewardClaimed: false
  };

  const activeMission = state.activeMission?.taskId === taskId ? null : state.activeMission;
  const tasks = state.tasks.map((item) => {
    if (item.id !== taskId) return item;
    return { ...item, status: "active", mission };
  });

  return withState({ ...state, tasks, activeMission, lastResult: null }, activeMission ? null : "clear");
}

export function resetTask(state, taskId) {
  return resetMission(state, taskId);
}

export function completeMission(state, options = {}) {
  const mission = options.missionOverride || getActiveMissionOrThrow(state);

  if (mission.currentSession < mission.totalSessions) {
    throw new Error("Finish all planned work sessions before completing the mission.");
  }

  const alreadyRewarded = Boolean(mission.rewardClaimed);
  const reward = alreadyRewarded ? { seedsEarned: 0, focusScore: 100 } : calculateReward(mission);
  const completedAt = Date.now();
  const completedMission = {
    ...mission,
    status: "completed",
    timerMode: "completed",
    previousTimerMode: null,
    remainingSeconds: 0,
    startedAt: null,
    rewardClaimed: true,
    completedAt
  };

  const tasks = state.tasks.map((task) => {
    if (task.id !== completedMission.taskId) return task;
    return { ...task, status: "completed", mission: completedMission };
  });

  return withState({
    ...state,
    tasks,
    activeMission: null,
    lastResult: {
      id: makeId("result"),
      missionId: completedMission.id,
      taskId: completedMission.taskId,
      taskTitle: completedMission.taskTitle,
      outcome: "completed",
      completed: true,
      totalSessions: completedMission.totalSessions,
      workDurationMinutes: completedMission.workDurationMinutes,
      restDurationMinutes: completedMission.restDurationMinutes,
      seedsEarned: reward.seedsEarned,
      focusScore: reward.focusScore,
      completedAt,
      note: alreadyRewarded ? "Mission was already rewarded." : "Reward granted once for completed planned sessions."
    },
    garden: {
      ...DEFAULT_STATE.garden,
      ...(state.garden || {}),
      seeds: Math.max(0, Number(state.garden?.seeds || 0) + reward.seedsEarned)
    }
  }, "clear");
}

export function clearResult(state) {
  return withState({ ...state, lastResult: null });
}

export function updateSettings(state, payload) {
  return withState({
    ...state,
    settings: validateSettingsInput(payload)
  });
}

export function resetSettings(state) {
  return withState({
    ...state,
    settings: { ...DEFAULT_SETTINGS }
  });
}

export function advanceTimer(state) {
  let mission = state.activeMission;
  if (!mission || !RUNNING_MODES.includes(mission.timerMode)) return withState(state);

  mission = normalizeMission(mission, null);
  const remainingSeconds = getRemainingSeconds(mission);
  if (remainingSeconds > 0) {
    return withState(state, "start");
  }

  if (mission.timerMode === "work") {
    const completedSessions = mission.currentSession + 1;
    if (completedSessions >= mission.totalSessions) {
      return completeMission(state, { missionOverride: { ...mission, currentSession: completedSessions } });
    }

    return withState(
      saveMission(state, mission.taskId, {
        ...mission,
        currentSession: completedSessions,
        timerMode: "rest",
        remainingSeconds: minutesToSeconds(mission.restDurationMinutes),
        startedAt: Date.now()
      }, "active"),
      "start"
    );
  }

  return withState(
    saveMission(state, mission.taskId, {
      ...mission,
      timerMode: "work",
      remainingSeconds: minutesToSeconds(mission.workDurationMinutes),
      startedAt: Date.now()
    }, "active"),
    "start"
  );
}

export function createMission(input) {
  return {
    id: makeId("mission"),
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    status: "not_started",
    totalSessions: input.totalSessions,
    currentSession: 0,
    workDurationMinutes: input.workDurationMinutes,
    restDurationMinutes: input.restDurationMinutes,
    timerMode: "idle",
    previousTimerMode: null,
    remainingSeconds: minutesToSeconds(input.workDurationMinutes),
    startedAt: null,
    completedAt: null,
    rewardClaimed: false,
    softBlockedSites: input.softBlockedSites,
    hardBlockedSites: input.hardBlockedSites
  };
}

export function normalizeTask(task) {
  const normalized = {
    ...task,
    deadlineDate: normalizeDateString(task.deadlineDate),
    status: task.status === "completed" ? "completed" : "active",
    softBlockedSites: normalizeSiteList(task.softBlockedSites),
    hardBlockedSites: normalizeSiteList(task.hardBlockedSites)
  };

  normalized.mission = normalizeMission(task.mission, normalized);
  normalized.softBlockedSites = normalized.mission.softBlockedSites;
  normalized.hardBlockedSites = normalized.mission.hardBlockedSites;
  return normalized;
}

export function normalizeMission(mission, task) {
  const workDurationMinutes = positiveNumber(mission?.workDurationMinutes || mission?.durationMinutes || task?.durationMinutes || 25);
  const restDurationMinutes = positiveNumber(mission?.restDurationMinutes || 5);
  const totalSessions = positiveInteger(mission?.totalSessions || 1);
  const timerMode = TIMER_MODES.includes(mission?.timerMode) ? mission.timerMode : "idle";

  return {
    id: mission?.id || makeId("mission"),
    taskId: mission?.taskId || task?.id || null,
    taskTitle: mission?.taskTitle || task?.title || "Untitled task",
    status: mission?.status || "not_started",
    totalSessions,
    currentSession: Math.min(Math.max(0, Number(mission?.currentSession || 0)), totalSessions),
    workDurationMinutes,
    restDurationMinutes,
    timerMode,
    previousTimerMode: mission?.previousTimerMode || null,
    remainingSeconds: Math.max(0, Number(mission?.remainingSeconds || minutesToSeconds(workDurationMinutes))),
    startedAt: mission?.startedAt || null,
    completedAt: mission?.completedAt || null,
    rewardClaimed: Boolean(mission?.rewardClaimed),
    softBlockedSites: normalizeSiteList(mission?.softBlockedSites || task?.softBlockedSites),
    hardBlockedSites: normalizeSiteList(mission?.hardBlockedSites || task?.hardBlockedSites)
  };
}

export function validateTaskInput(payload, defaults = DEFAULT_SETTINGS) {
  const title = String(payload.title || "").trim();
  const workDurationMinutes = positiveNumber(payload.workDurationMinutes ?? defaults.defaultWorkMinutes);
  const restDurationMinutes = positiveNumber(payload.restDurationMinutes ?? defaults.defaultRestMinutes);
  const totalSessions = positiveInteger(payload.totalSessions ?? defaults.defaultTotalSessions);

  if (!title) throw new Error("Task title is required.");
  if (!workDurationMinutes) throw new Error("Work duration must be a positive number.");
  if (!restDurationMinutes) throw new Error("Rest duration must be a positive number.");
  if (!totalSessions) throw new Error("Total sessions must be a positive whole number.");

  return {
    title,
    deadlineDate: normalizeDateString(payload.deadlineDate),
    workDurationMinutes,
    restDurationMinutes,
    totalSessions,
    softBlockedSites: normalizeSiteList(payload.softBlockedSites),
    hardBlockedSites: normalizeSiteList(payload.hardBlockedSites)
  };
}

export function validateSettingsInput(payload = {}) {
  const defaultWorkMinutes = positiveNumber(payload.defaultWorkMinutes);
  const defaultRestMinutes = positiveNumber(payload.defaultRestMinutes);
  const defaultTotalSessions = positiveInteger(payload.defaultTotalSessions);

  if (!defaultWorkMinutes) throw new Error("Default work duration must be a positive number.");
  if (!defaultRestMinutes) throw new Error("Default rest duration must be a positive number.");
  if (!defaultTotalSessions) throw new Error("Default total sessions must be a positive whole number.");

  return {
    defaultWorkMinutes,
    defaultRestMinutes,
    defaultTotalSessions,
    showCompletedTasks: payload.showCompletedTasks !== false,
    compactMode: payload.compactMode !== false
  };
}

export function getRemainingSeconds(mission) {
  if (!RUNNING_MODES.includes(mission.timerMode) || !mission.startedAt) {
    return Math.max(0, Number(mission.remainingSeconds || 0));
  }

  const elapsedSeconds = Math.floor((Date.now() - mission.startedAt) / 1000);
  return Math.max(0, Number(mission.remainingSeconds || 0) - elapsedSeconds);
}

export function getDisplaySeconds(mission) {
  if (!RUNNING_MODES.includes(mission.timerMode) || !mission.startedAt) {
    return Math.max(0, Number(mission.remainingSeconds || 0));
  }

  return getRemainingSeconds(mission);
}

export function getPeriodSeconds(mission) {
  if (mission.timerMode === "rest" || mission.previousTimerMode === "rest") {
    return minutesToSeconds(mission.restDurationMinutes);
  }

  return minutesToSeconds(mission.workDurationMinutes);
}

export function calculateReward(mission) {
  const workMinutes = mission.totalSessions * mission.workDurationMinutes;
  return {
    seedsEarned: Math.round(workMinutes * 0.8) + 10,
    focusScore: 100
  };
}

export function minutesToSeconds(minutes) {
  return Math.max(1, Math.round(Number(minutes) * 60));
}

export function formatSeconds(totalSeconds) {
  const roundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeSiteList(value) {
  if (Array.isArray(value)) return value.map(cleanSite).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map(cleanSite)
    .filter(Boolean);
}

export function getTodayDateString() {
  return formatLocalDate(new Date());
}

function normalizeSettings(settings = {}) {
  try {
    return validateSettingsInput({
      ...DEFAULT_SETTINGS,
      ...settings
    });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveMission(state, taskId, mission, taskStatus) {
  const normalized = normalizeMission(mission, null);
  const tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      status: taskStatus || task.status,
      mission: normalized,
      softBlockedSites: normalized.softBlockedSites,
      hardBlockedSites: normalized.hardBlockedSites
    };
  });

  return { ...state, tasks, activeMission: normalized };
}

function getActiveMissionOrThrow(state) {
  const mission = state.activeMission;
  if (!mission) throw new Error("There is no active mission.");
  return normalizeMission(mission, null);
}

function withState(state, alarm = null) {
  return { state: normalizeState(state), alarm };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function normalizeDateString(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return getTodayDateString();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanSite(site) {
  let value = String(site || "").trim().toLowerCase();
  if (!value) return "";

  try {
    if (!/^https?:\/\//.test(value)) value = `https://${value}`;
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^www\./, "");
  }
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Future website blocking should read mission.softBlockedSites and mission.hardBlockedSites,
// then connect them to webNavigation or declarativeNetRequest rules.
