import { DEFAULT_BLOCKING_ANALYTICS } from "./blocking/blockingConstants.js";

export const DEFAULT_SETTINGS = {
  defaultWorkMinutes: 20,
  defaultRestMinutes: 3,
  defaultTotalSessions: 2,
  showCompletedTasks: true,
  compactMode: true,
  theme: "dark",
  audioVolume: 100
};

export const DEFAULT_STATE = {
  tasks: [],
  activeMission: null,
  lastResult: null,
  sessionAlert: null,
  audioPlayedKeys: [],
  settings: { ...DEFAULT_SETTINGS },
  garden: {
    plants: [],
    coins: 0
  },
  totalFocusMinutes: 0,
  blockingAnalytics:  { ...DEFAULT_BLOCKING_ANALYTICS }
};

export const RUNNING_MODES = ["work", "rest"];
export const TIMER_MODES = ["idle", "work", "rest", "paused", "completed"];
