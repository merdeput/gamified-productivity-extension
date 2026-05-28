import { ensureState, getState, saveState } from "./storage.js";
import {
  advanceTimer,
  clearResult,
  completeMission,
  createTask,
  deleteTask,
  finishWorkSession,
  pauseMission,
  resetMission,
  resetTask,
  resumeMission,
  skipRest,
  startMission,
  takeRest,
  updateTask
} from "./state.js";

const MISSION_ALARM = "missionTick";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureState();
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureState();
  await runStateAction(advanceTimer);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === MISSION_ALARM) {
    await runStateAction(advanceTimer);
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
  const payload = message?.payload || {};

  if (type === "GET_STATE") {
    await runStateAction(advanceTimer);
    return getState();
  }

  if (type === "CREATE_TASK") return runStateAction((state) => createTask(state, payload));
  if (type === "UPDATE_TASK") return runStateAction((state) => updateTask(state, payload));
  if (type === "DELETE_TASK") return runStateAction((state) => deleteTask(state, payload.taskId));
  if (type === "START_MISSION") return runStateAction((state) => startMission(state, payload.taskId));
  if (type === "PAUSE_MISSION") return runStateAction(pauseMission);
  if (type === "RESUME_MISSION") return runStateAction(resumeMission);
  if (type === "FINISH_WORK_SESSION") return runStateAction(finishWorkSession);
  if (type === "TAKE_REST") return runStateAction(takeRest);
  if (type === "SKIP_REST") return runStateAction(skipRest);
  if (type === "COMPLETE_MISSION") return runStateAction(completeMission);
  if (type === "RESET_MISSION") return runStateAction((state) => resetMission(state, payload.taskId));
  if (type === "RESET_TASK") return runStateAction((state) => resetTask(state, payload.taskId));
  if (type === "CLEAR_RESULT") return runStateAction(clearResult);

  throw new Error(`Unknown message type: ${type}`);
}

async function runStateAction(action) {
  const state = await getState();
  const result = action(state);
  await saveState(result.state);
  await applyAlarmChange(result.alarm);
  return getState();
}

async function applyAlarmChange(alarm) {
  if (alarm === "start") {
    await chrome.alarms.create(MISSION_ALARM, { periodInMinutes: 1 });
  }

  if (alarm === "clear") {
    await chrome.alarms.clear(MISSION_ALARM);
  }
}
