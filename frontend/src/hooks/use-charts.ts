import { useQuery } from "@tanstack/react-query";
import { fetchCharts } from "@/services/api";
import type { ChartsData } from "@/types/session";

export function useCharts() {
  return useQuery<ChartsData>({
    queryKey: ["charts"],
    queryFn: fetchCharts,
    staleTime: 1000 * 60 * 5,
  });
}
