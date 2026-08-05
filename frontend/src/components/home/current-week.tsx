import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import type { Session } from "@/types/session";

interface CurrentWeekProps {
  completed: Session[];
  planned: Session[];
}

export function CurrentWeek({ completed, planned }: CurrentWeekProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const inWeek = (s: Session) =>
    isWithinInterval(parseISO(s.start_date_local), { start: weekStart, end: weekEnd });

  const done = completed.filter(inWeek);
  const pln = planned.filter(inWeek);

  const doneSessions = done.length;
  const plannedSessions = pln.length;
  const doneHours = done.reduce((sum, s) => sum + (s.time_s ?? 0), 0) / 3600;
  const plannedHours = pln.reduce((sum, s) => sum + (s.time_s ?? 0), 0) / 3600;
  const doneKm = done.reduce((sum, s) => sum + (s.distance_m ?? 0), 0) / 1000;
  const plannedKm = pln.reduce((sum, s) => sum + (s.distance_m ?? 0), 0) / 1000;

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Semana Actual</h2>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 rounded-xl bg-dark-300/30">
          <div className="text-lg font-semibold">
            {doneSessions}
            <span className="text-xs text-gray-500">/{plannedSessions}</span>
          </div>
          <div className="text-xs text-gray-500">sesiones hechas/plan</div>
        </div>
        <div className="p-3 rounded-xl bg-dark-300/30">
          <div className="text-lg font-semibold">
            {doneHours.toFixed(1)}h
            <span className="text-xs text-gray-500">/{plannedHours.toFixed(1)}h</span>
          </div>
          <div className="text-xs text-gray-500">horas hechas/plan</div>
        </div>
        <div className="p-3 rounded-xl bg-dark-300/30">
          <div className="text-lg font-semibold">{doneKm.toFixed(1)} km</div>
          <div className="text-xs text-gray-500">km esta semana</div>
        </div>
        <div className="p-3 rounded-xl bg-dark-300/30">
          <div className="text-lg font-semibold">
            {plannedKm > 0 ? `${Math.round((doneKm / plannedKm) * 100)}%` : "—"}
          </div>
          <div className="text-xs text-gray-500">km del plan</div>
        </div>
      </div>
    </div>
  );
}
