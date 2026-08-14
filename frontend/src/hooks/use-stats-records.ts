import { useQuery } from "@tanstack/react-query";
import { fetchStatsRecords } from "@/services/api";
import type { StatsRecordsData } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useStatsRecords() {
  const { activeTenantId } = useAuth();
  return useQuery<StatsRecordsData>({
    queryKey: ["stats-records", activeTenantId],
    queryFn: fetchStatsRecords,
    enabled: !!activeTenantId,
    staleTime: 1000 * 60 * 5,
  });
}
