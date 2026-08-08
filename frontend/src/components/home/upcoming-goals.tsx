import { parseISO, differenceInDays } from "date-fns";
import { Star } from "lucide-react";
import { useGoals } from "@/hooks/use-goals";
import { useMeta } from "@/hooks/use-meta";

function faviconUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

export function UpcomingGoals() {
  const { data: goals } = useGoals();
  const { data: meta } = useMeta();

  const today = new Date();
  if (!goals || !meta) return null;

  const planStart = parseISO(meta.planStart);
  const primary = goals.find((g) => g.isPrimary) ?? goals[0];

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Próximos Objetivos</h2>
      <div className="space-y-3">
        {goals.map((goal, i) => {
          const goalDate = parseISO(goal.date);
          const daysRemaining = differenceInDays(goalDate, today);
          const isPast = daysRemaining < 0;
          const isCurrent = !isPast && i === goals.findIndex((g) => differenceInDays(parseISO(g.date), today) >= 0);
          const isPrimary = primary?.week === goal.week;
          const totalDays = Math.max(1, differenceInDays(goalDate, planStart));
          const elapsedDays = Math.max(0, differenceInDays(today, planStart));
          const goalProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);
          const favicon = faviconUrl(goal.url);

          return (
            <div
              key={goal.week}
              className={`p-3 rounded-xl border transition-all ${
                isPast
                  ? "border-green-500/20 bg-green-500/5"
                  : isCurrent
                  ? "border-accent/40 bg-accent/5"
                  : "border-dark-400 bg-dark-300/30"
              } ${isPrimary ? "ring-1 ring-accent/40" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
                  {favicon ? (
                    <img src={favicon} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                  ) : null}
                  <span className="truncate">{goal.label}</span>
                  {isPrimary && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">
                      <Star className="w-3 h-3" /> Principal
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500 shrink-0">Semana {goal.week}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {isPast ? "Completado" : `${daysRemaining} días restantes`}
                </span>
                {goal.targetPace && goal.targetPace !== "—" && (
                  <span className="text-xs font-medium text-accent-light">{goal.targetPace}</span>
                )}
              </div>
              {!isPast && (
                <div className="progress-bar mt-2">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${goalProgress}%`,
                      backgroundColor: isCurrent ? "#3b82f6" : "#4ade80",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
