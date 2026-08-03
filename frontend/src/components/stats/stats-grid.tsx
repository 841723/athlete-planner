import { useSessions } from "@/hooks/use-sessions";
import {
  formatDistance,
  formatDuration,
  getSportLabel,
  getSportCategory,
} from "@/lib/utils";
import type { Session } from "@/types/session";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsGrid() {
  const { data, isLoading } = useSessions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const completed = data?.completed ?? [];
  const allSessions = [...completed];

  const totalDistance = allSessions.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const totalHours = allSessions.reduce(
    (sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600,
    0
  );
  const totalSessions = allSessions.length;

  const sportCounts: Record<string, number> = {};
  for (const s of allSessions) {
    const cat = getSportCategory(s.sport);
    sportCounts[cat] = (sportCounts[cat] ?? 0) + 1;
  }
  const topSport = Object.entries(sportCounts).sort(([, a], [, b]) => b - a)[0];

  const maxLoadWeek = allSessions.reduce((max, s) => {
    const week = s.start_date_local.slice(0, 10);
    return week;
  }, "");

  const runningSessions = allSessions.filter(
    (s) => getSportCategory(s.sport) === "running" && s.avg_pace_s_per_km
  );
  const avgPace =
    runningSessions.length > 0
      ? Math.round(
          runningSessions.reduce((sum, s) => sum + (s.avg_pace_s_per_km ?? 0), 0) /
            runningSessions.length
        )
      : null;

  const cyclingSessions = allSessions.filter(
    (s) => getSportCategory(s.sport) === "cycling" && s.avg_speed_ms
  );
  const avgSpeed =
    cyclingSessions.length > 0
      ? Math.round(
          cyclingSessions.reduce((sum, s) => sum + (s.avg_speed_ms ?? 0) * 3.6, 0) /
            cyclingSessions.length
        )
      : null;

  const swimSessions = allSessions.filter(
    (s) => getSportCategory(s.sport) === "swimming" && s.moving_time_s
  );
  const avgSwimTime =
    swimSessions.length > 0
      ? Math.round(
          swimSessions.reduce((sum, s) => sum + (s.moving_time_s ?? 0), 0) /
            swimSessions.length /
            60
        )
      : null;

  const stats = [
    { label: "Km totales", value: `${(totalDistance / 1000).toFixed(0)} km`, icon: "📏" },
    { label: "Horas totales", value: `${totalHours.toFixed(0)}h`, icon: "⏱️" },
    { label: "Sesiones", value: totalSessions, icon: "📊" },
    { label: "Deporte principal", value: topSport ? getSportLabel(topSport[0]) : "—", icon: "🏆" },
    { label: "Ritmo medio (carrera)", value: avgPace ? `${Math.floor(avgPace / 60)}:${(avgPace % 60).toString().padStart(2, "0")} min/km` : "—", icon: "🏃" },
    { label: "Velocidad media (bici)", value: avgSpeed ? `${avgSpeed} km/h` : "—", icon: "🚴" },
    { label: "Tiempo medio (natación)", value: avgSwimTime ? `${avgSwimTime} min` : "—", icon: "🏊" },
    { label: "Sesiones completadas", value: completed.length, icon: "✅" },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Estadísticas</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card card-hover p-5">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="stat-label mb-1">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}