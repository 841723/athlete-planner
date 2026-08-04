import { useQuery } from "@tanstack/react-query";
import { fetchWeekly } from "@/services/api";
import type { WeeklySummary } from "@/types/session";

export function useWeekly() {
  return useQuery<WeeklySummary[]>({
    queryKey: ["weekly"],
    queryFn: fetchWeekly,
    staleTime: 1000 * 60 * 5,
  });
}
