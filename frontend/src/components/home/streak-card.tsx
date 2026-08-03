import { parseISO, differenceInDays, eachDayOfInterval, format } from "date-fns";
import type { Session } from "@/types/session";

interface StreakCardProps {
  completed: Session[];
}

export function StreakCard({ completed }: StreakCardProps) {
  const today = new Date();
  const datesWithSessions = new Set(
    completed.map((s) => s.start_date_local.slice(0, 10))
  );

  let streak = 0;
  let current = today;
  while (datesWithSessions.has(format(current, "yyyy-MM-dd"))) {
    streak++;
    current = new Date(current.getTime() - 86400000);
  }

  const totalDistance = completed.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const totalHours = completed.reduce(
    (sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600,
    0
  );

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Racha</h2>
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gradient">{streak}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">días seguidos</div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-lg font-semibold">{(totalDistance / 1000).toFixed(0)}</div>
          <div className="text-xs text-gray-500">km totales</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{totalHours.toFixed(0)}</div>
          <div className="text-xs text-gray-500">horas totales</div>
        </div>
      </div>
    </div>
  );
}