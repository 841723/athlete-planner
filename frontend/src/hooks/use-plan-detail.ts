import { useQuery } from "@tanstack/react-query";
import { fetchPlanDetail } from "@/services/trainer";
import { useAuth } from "@/components/auth/auth-context";

export function usePlanDetail(planId: string | undefined) {
  const { activeTenantId } = useAuth();

  return useQuery({
    queryKey: ["plan-detail", activeTenantId, planId],
    queryFn: () => fetchPlanDetail(planId!),
    enabled: Boolean(activeTenantId && planId),
  });
}
