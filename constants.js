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
