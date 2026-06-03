import {
  formatLocalDate,
  getTodayDateString,
  normalizeDateString
} from "../../logic/utils.js";

export function getBoardDates(tasks) {
  const dates = new Set();
  const today = parseLocalDate(getTodayDateString());

  for (let offset = 0; offset < 5; offset += 1) {
    dates.add(formatLocalDate(addDays(today, offset)));
  }

  tasks.forEach((task) => dates.add(task.deadlineDate || getTodayDateString()));
  return [...dates].sort();
}

export function formatDateLabel(dateString) {
  const today = parseLocalDate(getTodayDateString());
  const date = parseLocalDate(dateString);
  const diffDays = Math.round((date - today) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return date.toLocaleDateString(undefined, { weekday: "long" });
}

export function getTaskDeadlineClass(task) {
  const deadlineDate = normalizeDateString(task.deadlineDate);
  const today = getTodayDateString();

  if (deadlineDate < today) return "task-card--past";
  if (deadlineDate === today) return "task-card--today";
  return "task-card--future";
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
