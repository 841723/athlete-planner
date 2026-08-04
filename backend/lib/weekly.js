import { startOfWeek, endOfWeek, parseISO } from "date-fns";
import { getSportCategory, getWeekNumber, getSessionTime, toLocalDateKey } from "./sessions.js";

export function buildWeeklySummary(completed, planned) {
  const allSessions = [
    ...completed.map((s) => ({ ...s, status: "completed" })),
    ...planned.map((s) => ({ ...s, status: "planned" })),
  ];

  const weekMap = new Map();

  for (const session of allSessions) {
    if (!session.start_date_local) continue;
    const date = parseISO(session.start_date_local);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = toLocalDateKey(weekStart);

    if (!weekMap.has(key)) {
      weekMap.set(key, { completed: [], planned: [] });
    }

    const entry = weekMap.get(key);
    if (session.status === "completed") {
      entry.completed.push(session);
    } else {
      entry.planned.push(session);
    }
  }

  const weeks = [];
  for (const [key, { completed: weekCompleted, planned: weekPlanned }] of weekMap) {
    const firstDate = parseISO(key);
    const weekStart = startOfWeek(firstDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(firstDate, { weekStartsOn: 1 });
    const weekNum = getWeekNumber(firstDate);

    const bySport = {};
    let totalHours = 0;
    let totalDistance = 0;
    let totalElevation = 0;

    for (const s of weekCompleted) {
      const cat = getSportCategory(s.sport);
      bySport[cat] = (bySport[cat] ?? 0) + 1;
      totalHours += getSessionTime(s) / 3600;
      totalDistance += (s.distance_m ?? 0) / 1000;
      totalElevation += s.total_elevation_gain_m ?? 0;
    }

    let plannedDistance = 0;
    let plannedHours = 0;
    for (const s of weekPlanned) {
      plannedDistance += (s.distance_m ?? 0) / 1000;
      plannedHours += getSessionTime(s) / 3600;
    }

    weeks.push({
      weekStart: toLocalDateKey(weekStart),
      weekEnd: toLocalDateKey(weekEnd),
      weekNumber: weekNum,
      sessions: weekCompleted.length,
      hours: Math.round(totalHours * 10) / 10,
      distance_km: Math.round(totalDistance * 10) / 10,
      elevation_m: Math.round(totalElevation),
      bySport,
      plannedSessions: weekPlanned.length,
      plannedDistance_km: Math.round(plannedDistance * 10) / 10,
      plannedHours: Math.round(plannedHours * 10) / 10,
    });
  }

  weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return weeks;
}
