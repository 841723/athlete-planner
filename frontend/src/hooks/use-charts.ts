import { useQuery } from "@tanstack/react-query";
import { fetchCharts } from "@/services/api";
import type { ChartsData } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useCharts() {
  const { activeTenantId } = useAuth();
  return useQuery<ChartsData>({
    queryKey: ["charts", activeTenantId],
    queryFn: fetchCharts,
    staleTime: 1000 * 60 * 5,
  });
}
