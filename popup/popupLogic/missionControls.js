export function setMissionButtonVisibility({ $, mission }) {
  const visibleButtonsByMode = {
    idle: ["startMissionBtn"],
    work: ["pauseMissionBtn", "finishWorkBtn", "resetMissionBtn"],
    rest: ["pauseMissionBtn", "skipRestBtn", "resetMissionBtn"],
    paused: ["resumeMissionBtn", "resetMissionBtn"],
    completed: ["resetMissionBtn"]
  };
  const visibleButtons = new Set(visibleButtonsByMode[mission.timerMode] || ["resetMissionBtn"]);

  ["startMissionBtn", "pauseMissionBtn", "resumeMissionBtn", "finishWorkBtn", "skipRestBtn", "resetMissionBtn"].forEach((id) => {
    $(id).classList.toggle("hidden", !visibleButtons.has(id));
  });
}
