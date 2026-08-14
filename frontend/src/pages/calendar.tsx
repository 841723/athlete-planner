import { useEffect, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { resetCalendarStore, useCalendarStore } from "@/lib/calendar-store";
import { useAuth } from "@/components/auth/auth-context";
import { CalendarView } from "@/components/calendar/calendar-view";
import { Skeleton } from "@/components/ui/skeleton";
import { isDateInRange } from "@/lib/utils";
import type { Session, SessionWithStatus } from "@/types/session";

function mergeSessions(completed: Session[], planned: Session[]): SessionWithStatus[] {
  return [
    ...completed.map((s) => ({ ...s, status: "completed" as const })),
    ...planned.map((s) => ({ ...s, status: "planned" as const })),
  ];
}

export function CalendarPage() {
  const { data, isLoading, error, refetch } = useSessions();
  const { activeTenantId } = useAuth();
  const { filters, setSport, setDateFrom, setDateTo, setShowCompleted, setShowPlanned, resetFilters } =
    useCalendarStore();

  useEffect(() => {
    resetCalendarStore();
  }, [activeTenantId]);

  const completed = data?.completed ?? [];
  const planned = data?.planned ?? [];
  const allSessions = mergeSessions(completed, planned);

  const filtered = useMemo(
    () =>
      allSessions.filter((s) => {
        if (filters.sport !== "all" && s.category !== filters.sport) return false;
        if (!isDateInRange(s.start_date_local, filters.dateFrom, filters.dateTo)) return false;
        if (s.status === "completed" && !filters.showCompleted) return false;
        if (s.status === "planned" && !filters.showPlanned) return false;
        return true;
      }),
    [allSessions, filters]
  );

  const filteredCompleted = filtered.filter((s) => s.status === "completed");
  const filteredPlanned = filtered.filter((s) => s.status === "planned");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-[600px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-300">No se pudieron cargar las sesiones.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <CalendarView
        completed={filteredCompleted}
        planned={filteredPlanned}
        filters={filters}
        setSport={setSport}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        setShowCompleted={setShowCompleted}
        setShowPlanned={setShowPlanned}
        resetFilters={resetFilters}
      />
    </div>
  );
}
