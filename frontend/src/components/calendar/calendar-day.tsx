import { format } from "date-fns";
import type { CSSProperties } from "react";
import { Trophy } from "lucide-react";
import type { Session, SessionWithStatus } from "@/types/session";
import { getSportColor, getSportLabel, formatDistance, hexToRgba } from "@/lib/utils";
import type { RaceGoal } from "@/lib/goals";

interface CalendarDayProps {
  date: Date;
  sessions: SessionWithStatus[];
  goal?: RaceGoal;
  onClick: (session: SessionWithStatus) => void;
  dimmed?: boolean;
}

function getCellBackground(sessions: SessionWithStatus[]): CSSProperties | undefined {
  if (sessions.length === 0) return undefined;
  const colors = sessions.map((s) => getSportColor(s.sport));
  if (colors.length === 1) {
    return { backgroundColor: hexToRgba(colors[0], 0.4) };
  }
  const stops = colors
    .map(
      (c, i) =>
        `${hexToRgba(c, 0.4)} ${(i / colors.length) * 100}%, ${hexToRgba(c, 0.4)} ${
          ((i + 1) / colors.length) * 100
        }%`
    )
    .join(", ");
  return { backgroundImage: `linear-gradient(135deg, ${stops})` };
}

export function CalendarDay({ date, sessions, goal, onClick, dimmed }: CalendarDayProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
  const background = getCellBackground(sessions);

  return (
    <div
      className={`min-h-[80px] lg:min-h-[100px] p-2 rounded-xl transition-all cursor-pointer min-w-0 overflow-hidden ${
        isToday
          ? "border-4 border-[#C8102E] ring-2 ring-[#C8102E]/30"
          : goal
          ? "border-2 border-[#C8102E]/60"
          : isPast
          ? "border-2 border-dark-400"
          : "border-2 border-dark-400/50 hover:border-dark-400/80"
      } ${dimmed ? "opacity-30" : ""}`}
      style={background}
      onClick={() => {
        if (sessions.length === 1) onClick(sessions[0]);
      }}
    >
      <div className="text-xs font-medium text-gray-300 mb-1 flex items-center justify-between">
        <span>
          {format(date, "EEE")}
          <span className={`ml-1 ${isToday ? "text-accent-light font-bold" : ""}`}>
            {format(date, "d")}
          </span>
        </span>
      </div>
      {goal && (
        <div className="flex items-center gap-1 mb-1 px-1 py-0.5 rounded-md bg-[#C8102E] text-white text-[10px] font-semibold">
          <Trophy className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{goal.label}</span>
        </div>
      )}
      <div className="space-y-1">
        {sessions.slice(0, 3).map((s) => {
          const color = getSportColor(s.sport);
          const label = getSportLabel(s.sport);
          const isPlanned = s.status === "planned";
          return (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 text-xs p-1 rounded-lg transition-colors ${
                isPlanned ? "border border-dashed border-white/20" : "hover:bg-black/25"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onClick(s);
              }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-black/30"
                style={{
                  backgroundColor: isPlanned ? "transparent" : color,
                  border: isPlanned ? `2px solid ${color}` : "none",
                }}
              />
              <span className={`truncate flex-1 font-medium ${isPlanned ? "text-white/60" : "text-white"}`}>
                {s.title ?? s.name}
              </span>
              {isPlanned && (
                <span className="text-[9px] uppercase tracking-wide text-white/40 flex-shrink-0">
                  Plan
                </span>
              )}
              {s.distance_m && (
                <span className="text-white/80 flex-shrink-0">{formatDistance(s.distance_m)}</span>
              )}
            </div>
          );
        })}
        {sessions.length > 3 && (
          <div className="text-xs text-white/70 text-center">+{sessions.length - 3} más</div>
        )}
      </div>
    </div>
  );
}
