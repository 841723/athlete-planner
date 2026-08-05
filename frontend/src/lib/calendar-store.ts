import { useSyncExternalStore } from "react";
import type { FilterState, SportCategory } from "@/types/session";

const DEFAULT_FILTERS: FilterState = {
  sport: "all",
  dateFrom: null,
  dateTo: null,
  showCompleted: true,
  showPlanned: true,
};

interface CalendarState {
  currentMonth: Date;
  filters: FilterState;
  showFilters: boolean;
}

let state: CalendarState = {
  currentMonth: new Date(),
  filters: { ...DEFAULT_FILTERS },
  showFilters: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CalendarState {
  return state;
}

export function useCalendarStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    currentMonth: s.currentMonth,
    filters: s.filters,
    showFilters: s.showFilters,
    setCurrentMonth: (d: Date) => {
      state = { ...state, currentMonth: d };
      emit();
    },
    setFilters: (f: FilterState) => {
      state = { ...state, filters: f };
      emit();
    },
    patchFilters: (partial: Partial<FilterState>) => {
      state = { ...state, filters: { ...state.filters, ...partial } };
      emit();
    },
    setSport: (sport: SportCategory | "all") => {
      state = { ...state, filters: { ...state.filters, sport } };
      emit();
    },
    setDateFrom: (date: string | null) => {
      state = { ...state, filters: { ...state.filters, dateFrom: date } };
      emit();
    },
    setDateTo: (date: string | null) => {
      state = { ...state, filters: { ...state.filters, dateTo: date } };
      emit();
    },
    setShowCompleted: (show: boolean) => {
      state = { ...state, filters: { ...state.filters, showCompleted: show } };
      emit();
    },
    setShowPlanned: (show: boolean) => {
      state = { ...state, filters: { ...state.filters, showPlanned: show } };
      emit();
    },
    setShowFilters: (v: boolean) => {
      state = { ...state, showFilters: v };
      emit();
    },
    resetFilters: () => {
      state = { ...state, filters: { ...DEFAULT_FILTERS } };
      emit();
    },
    goToToday: () => {
      state = { ...state, currentMonth: new Date() };
      emit();
    },
  };
}
