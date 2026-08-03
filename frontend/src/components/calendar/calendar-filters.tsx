import { useFilters } from "@/hooks/use-filters";
import type { SportCategory } from "@/types/session";
import { SPORT_LABELS, SPORT_COLORS } from "@/types/session";
import { Button } from "@/components/ui/button";

interface CalendarFiltersProps {
  filters: ReturnType<typeof useFilters>["filters"];
  setSport: (sport: SportCategory | "all") => void;
  setDateFrom: (date: string | null) => void;
  setDateTo: (date: string | null) => void;
  setShowCompleted: (show: boolean) => void;
  setShowPlanned: (show: boolean) => void;
  resetFilters: () => void;
}

export function CalendarFilters({
  filters,
  setSport,
  setDateFrom,
  setDateTo,
  setShowCompleted,
  setShowPlanned,
  resetFilters,
}: CalendarFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-4 animate-fade-in">
      <select
        className="select w-auto"
        value={filters.sport}
        onChange={(e) => setSport(e.target.value as SportCategory | "all")}
      >
        <option value="all">Todos los deportes</option>
        {Object.entries(SPORT_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="date"
        className="input w-auto"
        value={filters.dateFrom ?? ""}
        onChange={(e) => setDateFrom(e.target.value || null)}
        placeholder="Desde"
      />
      <input
        type="date"
        className="input w-auto"
        value={filters.dateTo ?? ""}
        onChange={(e) => setDateTo(e.target.value || null)}
        placeholder="Hasta"
      />
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
          className="rounded"
        />
        Completados
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.showPlanned}
          onChange={(e) => setShowPlanned(e.target.checked)}
          className="rounded"
        />
        Planificados
      </label>
      <Button variant="ghost" onClick={resetFilters}>
        Limpiar
      </Button>
    </div>
  );
}