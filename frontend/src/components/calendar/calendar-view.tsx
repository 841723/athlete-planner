import { useState, useMemo } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isSameMonth,
} from "date-fns";
import type { Session, SessionWithStatus, FilterState } from "@/types/session";
import { CalendarDay } from "./calendar-day";
import { CalendarFilters } from "./calendar-filters";
import type { SportCategory } from "@/types/session";
import { RACE_GOALS } from "@/lib/goals";
import { getWeekNumber, getSportCategory } from "@/lib/utils";

interface CalendarViewProps {
  completed: SessionWithStatus[];
  planned: SessionWithStatus[];
  filters: FilterState;
  setSport: (sport: SportCategory | "all") => void;
  setDateFrom: (date: string | null) => void;
  setDateTo: (date: string | null) => void;
  setShowCompleted: (show: boolean) => void;
  setShowPlanned: (show: boolean) => void;
  resetFilters: () => void;
}

export function CalendarView({ completed, planned, filters, setSport, setDateFrom, setDateTo, setShowCompleted, setShowPlanned, resetFilters }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const allSessions = useMemo(() => {
    const sessions: SessionWithStatus[] = [
      ...completed.map((s) => ({ ...s, status: "completed" as const })),
      ...planned.map((s) => ({ ...s, status: "planned" as const })),
    ];
    return sessions.filter((s) => {
      if (filters.sport !== "all") {
        if (getSportCategory(s.sport) !== filters.sport) return false;
      }
      return true;
    });
  }, [completed, planned, filters.sport]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStatus[]>();
    for (const s of allSessions) {
      const date = s.start_date_local.slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(s);
    }
    return map;
  }, [allSessions]);

  const goalsByDate = useMemo(() => {
    const map = new Map<string, (typeof RACE_GOALS)[number]>();
    for (const g of RACE_GOALS) map.set(g.date, g);
    return map;
  }, []);

  const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn btn-ghost px-2">
          ← Anterior
        </button>
        <h2 className="text-xl font-bold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn px-3 py-1.5 text-sm ${
              showFilters ? "bg-accent/20 text-accent-light" : "btn-ghost"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={nextMonth} className="btn btn-ghost px-2">
            Siguiente →
          </button>
        </div>
      </div>
      {showFilters && (
        <CalendarFilters
          filters={filters}
          setSport={setSport}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          setShowCompleted={setShowCompleted}
          setShowPlanned={setShowPlanned}
          resetFilters={resetFilters}
        />
      )}
      <div className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-1">
        <div />
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate.get(dateStr) ?? [];
          const isOtherMonth = !isSameMonth(day, currentMonth);
          const isWeekStart = day.getDay() === 1;

          return (
            <div key={dateStr} className="contents">
              {isWeekStart && (
                <div className={`flex items-center justify-center text-xs font-semibold select-none ${isOtherMonth ? "text-gray-600" : "text-gray-500"}`}>
                  W{getWeekNumber(day)}
                </div>
              )}
              <CalendarDay
                date={day}
                sessions={daySessions}
                goal={goalsByDate.get(dateStr)}
                onClick={setSelectedSession}
                dimmed={isOtherMonth}
              />
            </div>
          );
        })}
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedSession(null)}>
          <div className="card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selectedSession.title ?? selectedSession.name}</h3>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Fecha</span><span>{selectedSession.start_date_local}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Deporte</span><span>{selectedSession.sport}</span></div>
              {selectedSession.distance_m && <div className="flex justify-between"><span className="text-gray-400">Distancia</span><span>{(selectedSession.distance_m / 1000).toFixed(2)} km</span></div>}
              {selectedSession.moving_time_s && <div className="flex justify-between"><span className="text-gray-400">Tiempo</span><span>{(selectedSession.moving_time_s / 60).toFixed(0)} min</span></div>}
              {selectedSession.avg_heartrate && <div className="flex justify-between"><span className="text-gray-400">FC media</span><span>{selectedSession.avg_heartrate} bpm</span></div>}
              {selectedSession.training_effect && <div className="flex justify-between"><span className="text-gray-400">Efecto</span><span>{selectedSession.training_effect}</span></div>}
              {selectedSession.calories_kcal && <div className="flex justify-between"><span className="text-gray-400">Calorías</span><span>{selectedSession.calories_kcal} kcal</span></div>}
              {selectedSession.total_elevation_gain_m && <div className="flex justify-between"><span className="text-gray-400">Desnivel</span><span>{selectedSession.total_elevation_gain_m} m</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}