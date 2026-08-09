import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  parseISO,
  isSameMonth,
} from "date-fns";
import { format } from "@/lib/date-format";
import type { SessionWithStatus, FilterState, RaceGoal } from "@/types/session";
import { CalendarDay } from "./calendar-day";
import { CalendarFilters } from "./calendar-filters";
import type { SportCategory } from "@/types/session";
import { useGoals } from "@/hooks/use-goals";
import { useMeta } from "@/hooks/use-meta";
import { useDeletePlanned } from "@/hooks/use-planned";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import { useCalendarStore } from "@/lib/calendar-store";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { WorkoutText } from "@/components/session/workout-text";
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
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenantId } = useAuth();
  const { currentMonth, showFilters, setCurrentMonth, setShowFilters, goToToday } = useCalendarStore();
  const [selectedSession, setSelectedSession] = useState<SessionWithStatus | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deleteMutation = useDeletePlanned();
  const perms = usePermissions();

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
      ...planned
        .filter((s) => !s.merged_with)
        .map((s) => ({ ...s, status: "planned" as const })),
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

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn btn-ghost px-2">
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <div className="flex flex-col items-center gap-0.5 min-w-0">
          <h2 className="text-base sm:text-xl font-bold truncate capitalize px-1">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button onClick={goToToday} className="text-xs text-accent-light hover:text-accent">
            Ir a hoy
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn px-2 sm:px-3 py-1.5 text-sm ${
              showFilters ? "bg-accent/20 text-accent-light" : "btn-ghost"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={nextMonth} className="btn btn-ghost px-2">
            <ChevronRight className="w-4 h-4" />
            <span className="hidden sm:inline">Siguiente</span>
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
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] lg:grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-0.5 sm:gap-1">
        <div className="hidden lg:block" />
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="text-center text-[10px] sm:text-xs font-medium text-gray-500 py-1.5 sm:py-2">
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
                <div className={`hidden lg:flex items-center justify-center text-xs font-semibold select-none ${isOtherMonth ? "text-gray-600" : "text-gray-500"}`}>
                  W{getWeekNumber(day, meta?.trainingWeekOneStart ?? "2026-05-11")}
                </div>
              )}
              <CalendarDay
                date={day}
                sessions={daySessions}
                goal={goalsByDate.get(dateStr)}
                primary={goalsByDate.get(dateStr)?.isPrimary}
                onClick={(s) => {
                  if (s.status === "completed") {
                    navigate(tenantPath(activeTenantId, `/session/${s.id}`), { state: { from: location.pathname } });
                  } else {
                    setSelectedSession(s);
                  }
                }}
                onDayClick={setSelectedDay}
                dimmed={isOtherMonth}
              />
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="card w-full sm:max-w-md max-h-[75vh] overflow-y-auto animate-slide-up sm:animate-scale-in rounded-b-none sm:rounded-2xl p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold capitalize">
                {format(parseISO(selectedDay), "EEEE d 'de' MMMM")}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-white" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {(sessionsByDate.get(selectedDay) ?? []).map((s) => {
                const isPlanned = s.status === "planned";
                return (
                  <button
                    key={s.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      isPlanned ? "border border-dashed border-white/20 bg-dark-300/30" : "bg-dark-300/50 hover:bg-dark-300"
                    }`}
                    onClick={() => {
                      setSelectedDay(null);
                      if (isPlanned) setSelectedSession(s);
                      else navigate(tenantPath(activeTenantId, `/session/${s.id}`), { state: { from: location.pathname } });
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getSportColor(s.category) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title ?? s.name}</p>
                      <p className="text-xs text-gray-500">{getSportLabel(s.category)}</p>
                    </div>
                    {s.start_date_local && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {format(parseISO(s.start_date_local), "HH:mm")}
                      </span>
                    )}
                    {isPlanned && <span className="badge badge-planned">Plan</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedSession && selectedSession.status === "planned" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedSession(null)}>
          <div className="card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSportColor(selectedSession.category) }}
                />
                <h3 className="text-lg font-bold">{selectedSession.title ?? selectedSession.name}</h3>
                <span className="badge badge-planned">Plan</span>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-white" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Fecha planificada</span><span>{format(parseISO(selectedSession.start_date_local), "d MMM yyyy")}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Deporte</span><span>{getSportLabel(selectedSession.category)}</span></div>
              {selectedSession.workout_text ? (
                <div className="pt-2 border-t border-dark-400">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Trabajo</span>
                  <div className="mt-2">
                    <WorkoutText text={selectedSession.workout_text} />
                  </div>
                </div>
              ) : (() => {
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
              {perms.canEdit && (
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
