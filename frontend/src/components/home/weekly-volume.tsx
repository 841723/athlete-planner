import { useSessions } from "@/hooks/use-sessions";
import { SPORT_COLORS, SPORT_LABELS, type SportCategory } from "@/types/session";

export function WeeklyVolume() {
  const { data } = useSessions();
  const completed = data?.completed ?? [];

  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const weekCompleted = completed.filter((s) => {
    if (!s.start_date_local) return false;
    const d = new Date(s.start_date_local);
    return d >= weekStart && d < weekEnd;
  });

  const bySport: Record<string, number> = {};
  for (const s of weekCompleted) {
    const cat = (s.category ?? "other") as string;
    bySport[cat] = (bySport[cat] ?? 0) + (s.distance_m ?? 0) / 1000;
  }

  const sports = Object.keys(bySport).filter((k) => bySport[k] > 0);

  if (sports.length === 0) return null;

  const maxKm = Math.max(...sports.map((k) => bySport[k]), 1);

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-3">Volumen semanal</h2>
      <div className="space-y-3">
        {sports.map((sport) => {
          const cat = sport as SportCategory;
          const color = SPORT_COLORS[cat] ?? "#6b7280";
          const label = SPORT_LABELS[cat] ?? sport;
          const km = bySport[sport];
          return (
            <div key={sport}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-400">{km.toFixed(1)} km</span>
              </div>
              <div className="h-2 rounded-full bg-dark-400 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(km / maxKm) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
