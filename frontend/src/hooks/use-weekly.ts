import { useQuery } from "@tanstack/react-query";
import { fetchWeekly } from "@/services/api";
import type { WeeklySummary } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useWeekly() {
  const { activeTenantId } = useAuth();
  return useQuery<WeeklySummary[]>({
    queryKey: ["weekly", activeTenantId],
    queryFn: fetchWeekly,
    staleTime: 1000 * 60 * 5,
  });
}
