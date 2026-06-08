const SESSION_AUDIO_PATH = "assets/audios/end-of-session.mp3";

export function createSettingsPanel({ $, getSettings, sendAction, closePanel, setStatus }) {
  let previewAudio = null;

  function loadForm() {
    const settings = getSettings() || {};
    $("defaultWorkMinutesInput").value = settings.defaultWorkMinutes ?? 20;
    $("defaultRestMinutesInput").value = settings.defaultRestMinutes ?? 3;
    $("defaultTotalSessionsInput").value = settings.defaultTotalSessions ?? 2;
    $("showCompletedTasksInput").checked = settings.showCompletedTasks !== false;
    $("compactModeInput").checked = settings.compactMode !== false;
    $("themeInput").value = settings.theme === "dark" ? "dark" : "light";
    $("audioVolumeInput").value = settings.audioVolume ?? 100;
    $("quickAddBlockedSitesInput").value = formatSiteList(settings.quickAddBlockedSites);
    renderAudioVolumeValue();
  }

  function buildPayload() {
    return {
      defaultWorkMinutes: Number($("defaultWorkMinutesInput").value),
      defaultRestMinutes: Number($("defaultRestMinutesInput").value),
      defaultTotalSessions: Number($("defaultTotalSessionsInput").value),
      showCompletedTasks: $("showCompletedTasksInput").checked,
      compactMode: $("compactModeInput").checked,
      theme: $("themeInput").value,
      audioVolume: Number($("audioVolumeInput").value),
      quickAddBlockedSites: $("quickAddBlockedSitesInput").value
    };
  }

  function renderAudioVolumeValue() {
    $("audioVolumeValue").textContent = `${$("audioVolumeInput").value}%`;
  }

  async function testAudio() {
    try {
      previewAudio?.pause();
      previewAudio = new Audio(chrome.runtime.getURL(SESSION_AUDIO_PATH));
      previewAudio.volume = getAudioVolume($("audioVolumeInput").value);
      await previewAudio.play();
      setStatus("Playing audio preview.");
    } catch {
      setStatus("Audio preview was blocked by the browser.");
    }
  }

  async function resetSettings() {
    await sendAction("RESET_SETTINGS", null, "Settings reset to defaults.");
  }

  async function saveSettings(payload) {
    await sendAction("UPDATE_SETTINGS", payload, "Settings saved.");
    closePanel();
  }

  return {
    buildPayload,
    loadForm,
    renderAudioVolumeValue,
    resetSettings,
    saveSettings,
    testAudio
  };
}

export function getAudioVolume(value) {
  const volume = Number(value);
  return Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) / 100 : 1;
}

function formatSiteList(value) {
  return (Array.isArray(value) ? value : [])
    .filter(Boolean)
    .join("\n");
}
