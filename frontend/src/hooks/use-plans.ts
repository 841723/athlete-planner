import { useQuery } from "@tanstack/react-query";
import { fetchPlans } from "@/services/trainer";
import { useAuth } from "@/components/auth/auth-context";

export function usePlans() {
  const { activeTenantId } = useAuth();
  return useQuery({
    queryKey: ["plans", activeTenantId],
    queryFn: fetchPlans,
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
  });
}
