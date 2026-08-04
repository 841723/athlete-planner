import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/services/api";
import type { StatsData } from "@/types/session";

export function useStats() {
  return useQuery<StatsData>({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 5,
  });
}
