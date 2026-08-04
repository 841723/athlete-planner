import { useState, useMemo } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
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
import type { SessionWithStatus, FilterState, RaceGoal } from "@/types/session";
import { CalendarDay } from "./calendar-day";
import { CalendarFilters } from "./calendar-filters";
import type { SportCategory } from "@/types/session";
import { useGoals } from "@/hooks/use-goals";
import { useMeta } from "@/hooks/use-meta";
import { useDeletePlanned } from "@/hooks/use-planned";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { getWeekNumber, getSportLabel, getSportColor } from "@/lib/utils";

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
  const [selectedSession, setSelectedSession] = useState<SessionWithStatus | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const deleteMutation = useDeletePlanned();

  const { data: goals } = useGoals();
  const { data: meta } = useMeta();

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
        if (s.category !== filters.sport) return false;
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
    const map = new Map<string, RaceGoal>();
    for (const g of goals ?? []) map.set(g.date, g);
    return map;
  }, [goals]);

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
                  W{getWeekNumber(day, meta?.trainingWeekOneStart ?? "2026-05-11")}
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
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSportColor(selectedSession.category) }}
                />
                <h3 className="text-lg font-bold">{selectedSession.title ?? selectedSession.name}</h3>
                {selectedSession.status === "planned" && <span className="badge badge-planned">Plan</span>}
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {selectedSession.status === "planned" ? (
                <div className="flex justify-between"><span className="text-gray-400">Fecha planificada</span><span>{format(parseISO(selectedSession.start_date_local), "d MMM yyyy")}</span></div>
              ) : (
                <div className="flex justify-between"><span className="text-gray-400">Fecha</span><span>{format(parseISO(selectedSession.start_date_local), "d MMM yyyy")}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-400">Deporte</span><span>{getSportLabel(selectedSession.category)}</span></div>
              {selectedSession.status !== "planned" && selectedSession.distance_m && <div className="flex justify-between"><span className="text-gray-400">Distancia</span><span>{(selectedSession.distance_m / 1000).toFixed(2)} km</span></div>}
              {selectedSession.status !== "planned" && (() => {
                const t = selectedSession.time_s ?? 0;
                return t > 0 ? <div className="flex justify-between"><span className="text-gray-400">Tiempo</span><span>{(t / 60).toFixed(0)} min</span></div> : null;
              })()}
              {selectedSession.status !== "planned" && selectedSession.avg_heartrate && <div className="flex justify-between"><span className="text-gray-400">FC media</span><span>{selectedSession.avg_heartrate} bpm</span></div>}
              {selectedSession.status !== "planned" && selectedSession.training_effect && <div className="flex justify-between"><span className="text-gray-400">Efecto</span><span>{selectedSession.training_effect}</span></div>}
              {selectedSession.status !== "planned" && selectedSession.calories_kcal && <div className="flex justify-between"><span className="text-gray-400">Calorías</span><span>{selectedSession.calories_kcal} kcal</span></div>}
              {selectedSession.status !== "planned" && selectedSession.total_elevation_gain_m && <div className="flex justify-between"><span className="text-gray-400">Desnivel</span><span>{selectedSession.total_elevation_gain_m} m</span></div>}
              {selectedSession.status === "planned" && (() => {
                const objectives = selectedSession.objectives ?? [];
                return objectives.length > 0 ? (
                  <div className="pt-2 border-t border-dark-400">
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Objetivos</span>
                    <div className="mt-2 space-y-1.5">
                      {objectives.map((obj, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {obj.label && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">{obj.label}</span>}
                          <span className="text-sm">{obj.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {selectedSession.status === "planned" && (
                <div className="flex gap-2 pt-3 border-t border-dark-400">
                  <button
                    className="btn btn-ghost text-xs px-2 py-1"
                    onClick={() => setFormOpen(true)}
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button
                    className="btn btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-300"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${selectedSession.title ?? selectedSession.name}"?`)) {
                        deleteMutation.mutate(selectedSession.id);
                        setSelectedSession(null);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PlannedFormModal
        open={formOpen}
        session={selectedSession?.status === "planned" ? selectedSession : null}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
