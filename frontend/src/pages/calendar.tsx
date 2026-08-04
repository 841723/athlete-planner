import { useSessions } from "@/hooks/use-sessions";
import { useFilters } from "@/hooks/use-filters";
import { CalendarView } from "@/components/calendar/calendar-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session, SessionWithStatus } from "@/types/session";

function mergeSessions(completed: Session[], planned: Session[]): SessionWithStatus[] {
  return [
    ...completed.map((s) => ({ ...s, status: "completed" as const })),
    ...planned.map((s) => ({ ...s, status: "planned" as const })),
  ];
}

export function CalendarPage() {
  const { data, isLoading } = useSessions();

  const completed = data?.completed ?? [];
  const planned = data?.planned ?? [];
  const allSessions = mergeSessions(completed, planned);

  const { filters, setSport, setDateFrom, setDateTo, setShowCompleted, setShowPlanned, resetFilters, filtered } =
    useFilters(allSessions);

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
