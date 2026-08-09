import { parseISO, differenceInDays } from "date-fns";
import { Star, Target } from "lucide-react";
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
  const primaryColor = primary?.color || "#3b82f6";

  const otherGoals = goals.filter((g) => g.week !== primary?.week);

  const totalDays = primary ? Math.max(1, differenceInDays(parseISO(primary.date), planStart)) : 1;
  const elapsedDays = Math.max(0, differenceInDays(today, planStart));
  const goalProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-accent-light" />
        Objetivos
      </h2>

      {primary && (
        <div
          className="rounded-xl border p-4 mb-4"
          style={{
            borderColor: `${primaryColor}80`,
            background: `linear-gradient(135deg, ${primaryColor}24, transparent)`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Star className="w-3 h-3" /> Objetivo principal
            </span>
            {primary.targetPace && primary.targetPace !== "—" && (
              <span className="text-xs font-medium ml-auto" style={{ color: primaryColor }}>{primary.targetPace}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
              {primary.url ? (
                <a
                  href={primary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={primary.label}
                  className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                >
                  {faviconUrl(primary.url) ? (
                    <img src={faviconUrl(primary.url)!} alt="" className="w-5 h-5 rounded-sm shrink-0" referrerPolicy="no-referrer" />
                  ) : null}
                  <span className="text-base font-bold truncate">{primary.label}</span>
                </a>
              ) : (
                <span className="text-base font-bold truncate">{primary.label}</span>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              Semana {primary.week} · {formatDate(primary.date)}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">
                {differenceInDays(parseISO(primary.date), today) >= 0
                  ? `${differenceInDays(parseISO(primary.date), today)} días restantes`
                  : "Objetivo completado"}
              </span>
              <span className="font-semibold" style={{ color: primaryColor }}>{goalProgress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${goalProgress}%`, backgroundColor: primaryColor }} />
            </div>
          </div>
        </div>
      )}

      {otherGoals.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Hitos intermedios</div>
          {otherGoals.map((goal) => {
            const goalDate = parseISO(goal.date);
            const daysRemaining = differenceInDays(goalDate, today);
            const isPast = daysRemaining < 0;
            const isCurrent = !isPast && differenceInDays(goalDate, today) <= 28;
            const totalDaysGoal = Math.max(1, differenceInDays(goalDate, planStart));
            const goalProgressGoal = Math.min(Math.round((elapsedDays / totalDaysGoal) * 100), 100);
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
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
                    {goal.url ? (
                      <a
                        href={goal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={goal.label}
                        className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        {favicon ? (
                          <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" referrerPolicy="no-referrer" />
                        ) : null}
                        <span className="truncate">{goal.label}</span>
                      </a>
                    ) : (
                      <>
                        {favicon ? (
                          <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" referrerPolicy="no-referrer" />
                        ) : null}
                        <span className="truncate">{goal.label}</span>
                      </>
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
                        width: `${goalProgressGoal}%`,
                        backgroundColor: isCurrent ? "#3b82f6" : "#4ade80",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][d.getMonth()]}`;
}
