import { DEFAULT_BLOCKING_ANALYTICS } from "./blocking/blockingConstants.js";

export const DEFAULT_QUICK_ADD_BLOCKED_SITES = [
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "threads.com"
];

export const DEFAULT_SETTINGS = {
  defaultWorkMinutes: 20,
  defaultRestMinutes: 3,
  defaultTotalSessions: 2,
  showCompletedTasks: true,
  compactMode: true,
  theme: "dark",
  audioVolume: 100,
  quickAddBlockedSites: [...DEFAULT_QUICK_ADD_BLOCKED_SITES]
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
  gardens: {
    growing: {
      id: "growing",
      name: "Growing Garden",
      layoutId: "growing",
      mapFile: "growingMap.tmj",
      plantLayers: ["Plantable"],
      theme: "growing",
      unlocked: true,
      unlocks: {},
      upgrades: {},
      plants: [],
      coins: 0
    },
    water: {
      id: "water",
      name: "Water Garden",
      layoutId: "water",
      mapFile: "watermap.tmj",
      plantLayers: ["Plantable", "Aquatic"],
      theme: "water",
      unlocked: false,
      unlocks: {},
      upgrades: {},
      plants: [],
      coins: 0
    }
  },
  activeGardenId: "growing",
  totalFocusMinutes: 0,
  blockingAnalytics:  { ...DEFAULT_BLOCKING_ANALYTICS }
};

export const RUNNING_MODES = ["work", "rest"];
export const TIMER_MODES = ["idle", "work", "rest", "paused", "completed"];
