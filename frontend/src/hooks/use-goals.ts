import { useQuery } from "@tanstack/react-query";
import { fetchGoals } from "@/services/api";
import type { RaceGoal } from "@/types/session";

export function useGoals() {
  return useQuery<RaceGoal[]>({
    queryKey: ["goals"],
    queryFn: fetchGoals,
    staleTime: 1000 * 60 * 60,
  });
}
