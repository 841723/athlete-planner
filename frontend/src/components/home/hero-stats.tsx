import { format, parseISO, differenceInDays } from "date-fns";
import { useSessions } from "@/hooks/use-sessions";
import { useMeta } from "@/hooks/use-meta";

export function HeroStats() {
  const { data } = useSessions();
  const { data: meta } = useMeta();

  const today = new Date();

  if (!data || !meta) return null;

  const goalDate = parseISO(meta.goalDate);
  const planStart = parseISO(meta.planStart);
  const daysRemaining = differenceInDays(goalDate, today);
  const totalDays = differenceInDays(goalDate, planStart);
  const elapsedDays = Math.max(0, differenceInDays(today, planStart));
  const TOTAL_WEEKS = Math.ceil(totalDays / 7);
  const currentWeek = Math.min(Math.floor(elapsedDays / 7) + 1, TOTAL_WEEKS);
  const progressPercent = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);

  const nextGoal = [...data.planned]
    .filter((s) => parseISO(s.start_date_local) > today)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))[0];

  const stats = [
    { label: "Días restantes", value: daysRemaining, icon: "calendar" },
    { label: "Progreso", value: `${progressPercent}%`, icon: "trending" },
    { label: "Sesiones", value: data.totals.totalSessions, icon: "activity" },
    { label: "Próximo objetivo", value: nextGoal ? format(parseISO(nextGoal.start_date_local), "d MMM") : "—", icon: "flag" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat) => (
        <div key={stat.label} className="card card-hover p-5">
          <div className="stat-label mb-1">{stat.label}</div>
          <div className="stat-value">{stat.value}</div>
        </div>
      ))}
      <div className="card card-hover p-5 col-span-2 lg:col-span-4">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-label">Progreso del plan</span>
          <span className="text-sm font-semibold text-accent-light">{progressPercent}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Semana {currentWeek} de {TOTAL_WEEKS}</span>
          <span>{format(today, "d MMM yyyy")}</span>
        </div>
      </div>
    </div>
  );
}
