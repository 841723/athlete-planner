import { format } from "@/lib/date-format";
import { useSessions } from "@/hooks/use-sessions";

export function StreakCard() {
  const { data } = useSessions();

  const completed = data?.completed ?? [];
  const totalsCompleted = data?.totalsCompleted ?? { totalDistance: 0, totalHours: 0 };

  const today = new Date();
  const datesWithSessions = new Set(
    completed.map((s) => s.start_date_local.slice(0, 10))
  );

  const activeToday = datesWithSessions.has(format(today, "yyyy-MM-dd"));
  let streak = 0;
  let current = activeToday ? today : new Date(today.getTime() - 86400000);
  while (datesWithSessions.has(format(current, "yyyy-MM-dd"))) {
    streak++;
    current = new Date(current.getTime() - 86400000);
  }
  const inactive = !activeToday && streak > 0;

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Racha</h2>
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gradient">{streak}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">días seguidos</div>
        {inactive && (
          <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Sin entrenamiento hoy — se reinicia mañana
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-lg font-semibold">{(totalsCompleted.totalDistance / 1000).toFixed(0)}</div>
          <div className="text-xs text-gray-500">km totales</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{totalsCompleted.totalHours.toFixed(0)}</div>
          <div className="text-xs text-gray-500">horas totales</div>
        </div>
      </div>
    </div>
  );
}
