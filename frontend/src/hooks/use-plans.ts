import { useQuery } from "@tanstack/react-query";
import { fetchPlans } from "@/services/trainer";

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: fetchPlans,
    staleTime: 5 * 60 * 1000,
  });
}
