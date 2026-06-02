import { DEFAULT_SETTINGS, DEFAULT_STATE, RUNNING_MODES } from "./constants.js";
import {
  calculateReward,
  createMission,
  getRemainingSeconds,
  makeId,
  minutesToSeconds,
  normalizeDateString,
  normalizeMission,
  normalizeState,
  validateSettingsInput,
  validateTaskInput
} from "./utils.js";

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
  const workMinutes = mission.workDurationMinutes;
  const currentFocusMinutes = state.totalFocusMinutes || 0;
  
  if (completedSessions >= mission.totalSessions) {
    return completeMission(state, { 
      missionOverride: { ...mission, currentSession: completedSessions },
      focusMinutesAdded: workMinutes,
      currentFocusMinutes
    });
  }

  return withState(
    {
      ...saveMission(state, mission.taskId, {
        ...mission,
        currentSession: completedSessions,
        timerMode: "rest",
        previousTimerMode: null,
        remainingSeconds: minutesToSeconds(mission.restDurationMinutes),
        startedAt: Date.now()
      }, "active"),
      totalFocusMinutes: currentFocusMinutes + workMinutes
    },
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
  const reward = alreadyRewarded ? { coinsEarned: 0, focusScore: 100 } : calculateReward(mission);
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

  // Add focus minutes if provided
  const totalFocusMinutes = (state.totalFocusMinutes || 0) + (options.focusMinutesAdded || 0);

  return withState({
    ...state,
    tasks,
    activeMission: null,
    totalFocusMinutes,
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
      coinsEarned: reward.coinsEarned,
      focusScore: reward.focusScore,
      completedAt,
      note: alreadyRewarded ? "Mission was already rewarded." : "Reward granted once for completed planned sessions."
    },
    garden: {
      plants: state.garden?.plants || [],
      coins: Math.max(0, Number(state.garden?.coins || 0) + reward.coinsEarned)
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
    const workMinutes = mission.workDurationMinutes;
    const currentFocusMinutes = state.totalFocusMinutes || 0;
    
    if (completedSessions >= mission.totalSessions) {
      return completeMission(state, { 
        missionOverride: { ...mission, currentSession: completedSessions },
        focusMinutesAdded: workMinutes,
        currentFocusMinutes
      });
    }

    return withState(
      {
        ...saveMission(state, mission.taskId, {
          ...mission,
          currentSession: completedSessions,
          timerMode: "rest",
          remainingSeconds: minutesToSeconds(mission.restDurationMinutes),
          startedAt: Date.now()
        }, "active"),
        totalFocusMinutes: currentFocusMinutes + workMinutes
      },
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

// Future website blocking should read mission.softBlockedSites and mission.hardBlockedSites,
// then connect them to webNavigation or declarativeNetRequest rules.
