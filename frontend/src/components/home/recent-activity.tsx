import { useSessions } from "@/hooks/use-sessions";
import { SPORT_COLORS, SPORT_LABELS, type SportCategory } from "@/types/session";
import { useNavigate } from "react-router-dom";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatPace(paceSPerKm: number): string {
  const m = Math.floor(paceSPerKm / 60);
  const s = Math.floor(paceSPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function RecentActivity() {
  const { data } = useSessions();
  const navigate = useNavigate();
  const completed = data?.completed ?? [];

  const recent = [...completed]
    .sort((a, b) => (b.start_date_local ?? "").localeCompare(a.start_date_local ?? ""))
    .slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-3">Últimas actividades</h2>
      <div className="space-y-2">
        {recent.map((session) => {
          const cat = (session.category ?? "other") as SportCategory;
          const color = SPORT_COLORS[cat] ?? "#6b7280";
          const date = session.start_date_local
            ? new Date(session.start_date_local).toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
              })
            : "";
          return (
            <button
              key={session.id}
              onClick={() => navigate(`/session/${session.id}`)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-dark-300/30 hover:bg-dark-300/60 transition-colors text-left"
            >
              <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {session.title ?? session.name}
                  </span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{date}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{SPORT_LABELS[cat] ?? cat}</span>
                  {session.distance_m != null && (
                    <span>{(session.distance_m / 1000).toFixed(1)} km</span>
                  )}
                  {session.moving_time_s != null && (
                    <span>{formatDuration(session.moving_time_s)}</span>
                  )}
                  {session.avg_pace_s_per_km != null && (
                    <span>{formatPace(session.avg_pace_s_per_km)}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
