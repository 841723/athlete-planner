import { useMemo } from "react";
import { startOfWeek, endOfWeek, parseISO } from "date-fns";
import type { Session, WeeklySummary, SportCategory, SessionWithStatus } from "@/types/session";
import { getSportCategory, getWeekNumber } from "@/lib/utils";

export function useWeeklySummary(completed: Session[], planned: Session[]) {
  const summary = useMemo(() => {
    const allSessions: SessionWithStatus[] = [
      ...completed.map((s) => ({ ...s, status: "completed" as const })),
      ...planned.map((s) => ({ ...s, status: "planned" as const })),
    ];

    const weekMap = new Map<string, { completed: SessionWithStatus[]; planned: SessionWithStatus[] }>();

    for (const session of allSessions) {
      const date = parseISO(session.start_date_local);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = weekStart.toISOString().slice(0, 10);

      if (!weekMap.has(key)) {
        weekMap.set(key, { completed: [], planned: [] });
      }

      const entry = weekMap.get(key)!;
      if (session.status === "completed") {
        entry.completed.push(session);
      } else {
        entry.planned.push(session);
      }
    }

    const weeks: WeeklySummary[] = [];
    for (const [key, { completed: weekCompleted, planned: weekPlanned }] of weekMap) {
      const firstDate = parseISO(key);
      const weekStart = startOfWeek(firstDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(firstDate, { weekStartsOn: 1 });
      const weekNum = getWeekNumber(firstDate);

      const bySport = {} as Record<SportCategory, number>;
      let totalHours = 0;
      let totalDistance = 0;
      let totalElevation = 0;

      for (const s of weekCompleted) {
        const cat = getSportCategory(s.sport);
        bySport[cat] = (bySport[cat] ?? 0) + 1;
        totalHours += (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600;
        totalDistance += (s.distance_m ?? 0) / 1000;
        totalElevation += s.total_elevation_gain_m ?? 0;
      }

      let plannedDistance = 0;
      let plannedHours = 0;
      for (const s of weekPlanned) {
        plannedDistance += (s.distance_m ?? 0) / 1000;
        plannedHours += (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600;
      }

      weeks.push({
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
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
  }, [completed, planned]);

  return summary;
}