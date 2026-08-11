import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/services/api";
import type { StatsData } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useStats() {
  const { activeTenantId } = useAuth();
  return useQuery<StatsData>({
    queryKey: ["stats", activeTenantId],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 5,
  });
}
