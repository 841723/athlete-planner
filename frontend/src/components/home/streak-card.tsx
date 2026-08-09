import { Flame } from "lucide-react";
import { format } from "@/lib/date-format";
import { useSessions } from "@/hooks/use-sessions";

export function StreakCard() {
  const { data } = useSessions();

  const completed = data?.completed ?? [];

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

  const flameCls = activeToday
    ? "text-orange-400 animate-flame drop-shadow-[0_0_12px_rgba(251,146,60,0.6)]"
    : "text-gray-500";

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Racha</h2>
        <Flame className={`w-7 h-7 ${flameCls}`} />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <div
            className={`text-5xl font-bold ${
              activeToday ? "text-gradient" : "text-gray-400"
            }`}
          >
            {streak}
          </div>
        </div>
        <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
          {streak === 1 ? "día seguido" : "días seguidos"}
        </div>
        {activeToday ? (
          <div className="mt-3 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            Entrenado hoy — ¡la racha sigue viva!
          </div>
        ) : (
          <div className="mt-3 text-xs text-gray-500 bg-dark-400/40 border border-dark-400 rounded-lg px-3 py-2">
            {streak > 0
              ? `Sin entrenamiento hoy — llevabas ${streak} ${streak === 1 ? "día" : "días"}. Se reinicia mañana`
              : "Aún no has entrenado hoy. ¡Empieza una racha!"}
          </div>
        )}
      </div>
    </div>
  );
}
