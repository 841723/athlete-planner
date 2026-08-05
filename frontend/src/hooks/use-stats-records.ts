import { useQuery } from "@tanstack/react-query";
import { fetchStatsRecords } from "@/services/api";
import type { StatsRecordsData } from "@/types/session";

export function useStatsRecords() {
  return useQuery<StatsRecordsData>({
    queryKey: ["stats-records"],
    queryFn: fetchStatsRecords,
    staleTime: 1000 * 60 * 5,
  });
}
