import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  RUNNING_MODES,
  TIMER_MODES
} from "./constants.js";

export function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

export function getTodayDateString() {
  return formatLocalDate(new Date());
}

export function normalizeDateString(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return getTodayDateString();
}

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeSiteList(value) {
  if (Array.isArray(value)) return value.map(cleanSite).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map(cleanSite)
    .filter(Boolean);
}

export function cleanSite(site) {
  let value = String(site || "").trim().toLowerCase();
  if (!value) return "";

  try {
    if (!/^https?:\/\//.test(value)) value = `https://${value}`;
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^www\./, "");
  }
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
    },
    totalFocusMinutes: Math.max(0, Number(stored.totalFocusMinutes || 0))
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
  const workDurationMinutes = positiveNumber(mission?.workDurationMinutes || mission?.durationMinutes || task?.durationMinutes || 20);
  const restDurationMinutes = positiveNumber(mission?.restDurationMinutes || 3);
  const totalSessions = positiveInteger(mission?.totalSessions || 2);
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

export function normalizeSettings(settings = {}) {
  try {
    return validateSettingsInput({
      ...DEFAULT_SETTINGS,
      ...settings
    });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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
    compactMode: payload.compactMode !== false,
    theme: payload.theme === "dark" ? "dark" : "light"
  };
}

export function calculateReward(mission) {
  const workMinutes = mission.totalSessions * mission.workDurationMinutes;
  return {
    coinsEarned: Math.round(workMinutes * 0.8) + 10,
    focusScore: 100
  };
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
