import { useState, useCallback, useMemo } from "react";
import type { FilterState, SessionWithStatus } from "@/types/session";
import { isDateInRange } from "@/lib/utils";

const DEFAULT_FILTERS: FilterState = {
  sport: "all",
  dateFrom: null,
  dateTo: null,
  showCompleted: true,
  showPlanned: true,
};

export function useFilters(sessions: SessionWithStatus[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setSport = useCallback((sport: FilterState["sport"]) => {
    setFilters((prev) => ({ ...prev, sport }));
  }, []);

  const setDateFrom = useCallback((date: string | null) => {
    setFilters((prev) => ({ ...prev, dateFrom: date }));
  }, []);

  const setDateTo = useCallback((date: string | null) => {
    setFilters((prev) => ({ ...prev, dateTo: date }));
  }, []);

  const setShowCompleted = useCallback((show: boolean) => {
    setFilters((prev) => ({ ...prev, showCompleted: show }));
  }, []);

  const setShowPlanned = useCallback((show: boolean) => {
    setFilters((prev) => ({ ...prev, showPlanned: show }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      if (filters.sport !== "all" && session.category !== filters.sport) return false;
      if (!isDateInRange(session.start_date_local, filters.dateFrom, filters.dateTo)) return false;
      if (session.status === "completed" && !filters.showCompleted) return false;
      if (session.status === "planned" && !filters.showPlanned) return false;
      return true;
    });
  }, [sessions, filters]);

  return {
    filters,
    setSport,
    setDateFrom,
    setDateTo,
    setShowCompleted,
    setShowPlanned,
    resetFilters,
    filtered,
  };
}