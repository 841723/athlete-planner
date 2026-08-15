import { addDays } from "date-fns";
import { format } from "@/lib/date-format";
import type { Session } from "@/types/session";
import { WorkoutText } from "@/components/session/workout-text";
import { formatWeekdayDate, formatShortDate, getSportColor, getSportLabel, formatDistance, formatDuration, localDateKey } from "@/lib/utils";

interface TodayTomorrowProps {
  completed: Session[];
  planned: Session[];
}

export function TodayTomorrow({ completed, planned }: TodayTomorrowProps) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const plannedIds = new Set(planned.map((s) => s.id));

  const todaySessions = [...completed, ...planned].filter(
    (s) => s.start_date_local.startsWith(todayStr)
  );
  const tomorrowSessions = [...completed, ...planned].filter(
    (s) => s.start_date_local.startsWith(tomorrowStr)
  );

  return (
    <div className="card p-5 animate-slide-up">
      <h2 className="text-lg font-semibold mb-4">Hoy y Mañana</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
             {formatWeekdayDate(`${localDateKey(today)}T12:00:00`)}
          </h3>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin entrenamiento hoy</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <SessionCard key={s.id} session={s} isPlanned={plannedIds.has(s.id)} />
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
             {formatWeekdayDate(`${localDateKey(addDays(today, 1))}T12:00:00`)}
          </h3>
          {tomorrowSessions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin entrenamiento mañana</p>
          ) : (
            <div className="space-y-2">
              {tomorrowSessions.map((s) => (
                <SessionCard key={s.id} session={s} isPlanned={plannedIds.has(s.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session, isPlanned }: { session: Session; isPlanned: boolean }) {
  const color = getSportColor(session.category);
  const label = getSportLabel(session.category);
  const time = session.time_s ?? 0;
  const objectives = isPlanned ? session.objectives ?? [] : [];

  if (isPlanned) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-dark-400 bg-dark-300/30">
        <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">{session.title ?? session.name}</span>
            <span className="badge badge-planned">Plan</span>
          </div>
          <div className="text-xs text-gray-500">
            <span>{label}</span>
            <span className="mx-1">·</span>
             <span>{formatShortDate(session.start_date_local)}</span>
          </div>
          {isPlanned && session.workout_text ? (
            <div className="mt-2">
              <WorkoutText text={session.workout_text} />
            </div>
          ) : (
            objectives.length > 0 && (
              <div className="mt-2 space-y-1">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {obj.label && <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-accent/20 text-accent-light">{obj.label}</span>}
                    <span className="text-gray-300">{obj.text}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 hover:bg-dark-300 transition-colors">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{session.title ?? session.name}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
      <div className="text-right text-xs text-gray-400 flex-shrink-0">
        {session.distance_m ? formatDistance(session.distance_m) : ""}
        {time > 0 && ` · ${formatDuration(time)}`}
      </div>
    </div>
  );
}
