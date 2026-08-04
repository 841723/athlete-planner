import fs from "node:fs";
import path from "node:path";
import { differenceInDays, parseISO, startOfWeek } from "date-fns";

export const SESSIONS_DIR = path.resolve(import.meta.dirname, "..", "..", "sessions");
export const PLANNED_DIR = path.join(SESSIONS_DIR, "planned");

export const SPORT_CATEGORIES = {
  running: "running",
  trail_running: "running",
  cycling: "cycling",
  virtual_ride: "cycling",
  indoor_cycling: "cycling",
  swimming: "swimming",
  lap_swimming: "swimming",
  open_water_swimming: "swimming",
  strength_training: "strength",
  hiking: "hiking",
  walking: "walking",
  paddelball: "padel",
  other: "other",
  breathwork: "other",
  assistance: "other",
  resort_skiing: "other",
  tennis_v2: "other",
  elliptical: "other",
};

export const RACKET_SPORTS = new Set(["paddelball", "tennis_v2"]);

export const TRAINING_WEEK_ONE_START = "2026-05-11";

export function getSportCategory(sport) {
  return SPORT_CATEGORIES[sport] ?? "other";
}

export function getSessionTime(s) {
  const racket = RACKET_SPORTS.has(s.sport);
  const primary = racket ? s.elapsed_time_s : s.moving_time_s;
  const fallback = racket ? s.moving_time_s : s.elapsed_time_s;
  return primary ?? fallback ?? 0;
}

export function getWeekNumber(date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const anchor = parseISO(TRAINING_WEEK_ONE_START);
  const diffDays = differenceInDays(weekStart, anchor);
  return Math.floor(diffDays / 7) + 1;
}

export function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date) {
  const start = getWeekStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

export function toLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readJson(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    return s?.id ? s : null;
  } catch {
    return null;
  }
}

export function enrich(session) {
  return {
    ...session,
    category: getSportCategory(session.sport),
    time_s: getSessionTime(session),
    weekNumber: session.start_date_local
      ? getWeekNumber(new Date(session.start_date_local))
      : null,
  };
}

export function loadCompletedSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const sessions = [];
  for (const file of fs.readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    if (file === "all.json" || file === "missing.json") continue;
    const full = path.join(SESSIONS_DIR, file);
    if (fs.statSync(full).isDirectory()) continue;
    const s = readJson(full);
    if (s) sessions.push(enrich(s));
  }
  return sessions;
}

export function loadPlannedSessions() {
  if (!fs.existsSync(PLANNED_DIR)) return [];
  const sessions = [];
  for (const file of fs.readdirSync(PLANNED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const s = readJson(path.join(PLANNED_DIR, file));
    if (s) sessions.push(enrich(s));
  }
  return sessions;
}

export function loadAllSessions() {
  return { completed: loadCompletedSessions(), planned: loadPlannedSessions() };
}
