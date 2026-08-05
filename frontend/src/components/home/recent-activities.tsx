import { useNavigate, useLocation } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/date-format";
import type { Session } from "@/types/session";
import { getSportColor, getSportLabel, formatDistance, formatDuration } from "@/lib/utils";

interface RecentActivitiesProps {
  completed: Session[];
}

const LIMIT = 6;

export function RecentActivities({ completed }: RecentActivitiesProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const recent = [...completed]
    .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
    .slice(0, LIMIT);

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Últimas Actividades</h2>
        <button
          onClick={() => navigate("/calendar")}
          className="text-xs text-accent-light hover:underline"
        >
          Ver todas
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-gray-500">Sin actividades todavía.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/session/${s.id}`, { state: { from: location.pathname } })}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-300/50 hover:bg-dark-300 transition-colors text-left"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getSportColor(s.category) }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.title ?? s.name}</div>
                <div className="text-xs text-gray-400">
                  {getSportLabel(s.category)} · {format(parseISO(s.start_date_local), "EEE d MMM")}
                </div>
              </div>
              <div className="text-right text-xs text-gray-400 flex-shrink-0">
                {s.distance_m ? formatDistance(s.distance_m) : ""}
                {(s.time_s ?? 0) > 0 && ` · ${formatDuration(s.time_s)}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
