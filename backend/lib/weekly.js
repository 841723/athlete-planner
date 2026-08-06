import { startOfWeek, endOfWeek, parseISO } from "date-fns";
import { getSportCategory, getWeekNumber, getSessionTime, toLocalDateKey } from "./sessions.js";

export function buildWeeklySummary(completed) {
  const weekMap = new Map();

  for (const session of completed) {
    if (!session.start_date_local) continue;
    const date = parseISO(session.start_date_local);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = toLocalDateKey(weekStart);

    if (!weekMap.has(key)) {
      weekMap.set(key, []);
    }
    weekMap.get(key).push(session);
  }

  const weeks = [];
  for (const [key, weekSessions] of weekMap) {
    const firstDate = parseISO(key);
    const weekStart = startOfWeek(firstDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(firstDate, { weekStartsOn: 1 });
    const weekNum = getWeekNumber(firstDate);

    const bySport = {};
    let totalHours = 0;
    let totalDistance = 0;
    let totalElevation = 0;

    for (const s of weekSessions) {
      const cat = getSportCategory(s.sport);
      bySport[cat] = (bySport[cat] ?? 0) + 1;
      totalHours += getSessionTime(s) / 3600;
      totalDistance += (s.distance_m ?? 0) / 1000;
      totalElevation += s.total_elevation_gain_m ?? 0;
    }

    weeks.push({
      weekStart: toLocalDateKey(weekStart),
      weekEnd: toLocalDateKey(weekEnd),
      weekNumber: weekNum,
      sessions: weekSessions.length,
      hours: Math.round(totalHours * 10) / 10,
      distance_km: Math.round(totalDistance * 10) / 10,
      elevation_m: Math.round(totalElevation),
      bySport,
    });
  }

  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return weeks;
}
