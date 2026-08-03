import { parseISO, differenceInDays } from "date-fns";
import type { Session } from "@/types/session";
import { RACE_GOALS } from "@/lib/goals";

interface UpcomingGoalsProps {
  completed: Session[];
}

const PLAN_START = "2026-05-12";
const GOALS = RACE_GOALS;

export function UpcomingGoals({ completed }: UpcomingGoalsProps) {
  const today = new Date();
  const planStart = parseISO(PLAN_START);

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Próximos Objetivos</h2>
      <div className="space-y-3">
        {GOALS.map((goal, i) => {
          const goalDate = parseISO(goal.date);
          const daysRemaining = differenceInDays(goalDate, today);
          const isPast = daysRemaining < 0;
          const isCurrent = !isPast && i === GOALS.findIndex((g) => differenceInDays(parseISO(g.date), today) >= 0);
          const totalDays = Math.max(1, differenceInDays(goalDate, planStart));
          const elapsedDays = Math.max(0, differenceInDays(today, planStart));
          const goalProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);

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
                <span className="text-sm font-semibold">{goal.label}</span>
                <span className="text-xs text-gray-500">Semana {goal.week}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {isPast ? "Completado" : `${daysRemaining} días restantes`}
                </span>
                {goal.targetPace !== "—" && (
                  <span className="text-xs font-medium text-accent-light">{goal.targetPace}</span>
                )}
              </div>
              {!isPast && (
                <div className="progress-bar mt-2">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${goalProgress}%`,
                      backgroundColor: isCurrent ? "#818cf8" : "#4ade80",
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