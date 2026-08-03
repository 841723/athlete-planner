import { format, parseISO, addDays } from "date-fns";
import type { Session } from "@/types/session";
import { getSportColor, getSportLabel, formatDistance, formatDuration, formatPace } from "@/lib/utils";

interface TodayTomorrowProps {
  completed: Session[];
  planned: Session[];
}

export function TodayTomorrow({ completed, planned }: TodayTomorrowProps) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");

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
            {format(today, "EEEE d 'de' MMMM")}
          </h3>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin entrenamiento hoy</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            {format(addDays(today, 1), "EEEE d 'de' MMMM")}
          </h3>
          {tomorrowSessions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin entrenamiento mañana</p>
          ) : (
            <div className="space-y-2">
              {tomorrowSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const color = getSportColor(session.sport);
  const label = getSportLabel(session.sport);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 hover:bg-dark-300 transition-colors">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{session.name}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
      <div className="text-right text-xs text-gray-400 flex-shrink-0">
        {session.distance_m ? formatDistance(session.distance_m) : ""}
        {session.moving_time_s && ` · ${formatDuration(session.moving_time_s)}`}
      </div>
    </div>
  );
}