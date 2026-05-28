import { DEFAULT_STATE, normalizeState } from "./state.js";

export async function ensureState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  const state = normalizeState(stored);
  await saveState(state);
  return state;
}

export async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return normalizeState(stored);
}

export async function saveState(state) {
  await chrome.storage.local.set(normalizeState(state));
}
