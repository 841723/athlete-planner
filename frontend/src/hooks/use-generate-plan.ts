import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generatePlan } from "@/services/api";
import { invalidateMany } from "@/lib/invalidate";
import type { GeneratePlanRequest, GeneratePlanResponse } from "@/types/session";

const INVALIDATE = ["sessions", "weekly", "stats", "charts", "planned", "stats-records", "profile", "profile-history"];

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation<GeneratePlanResponse, Error, GeneratePlanRequest>({
    mutationFn: (payload: GeneratePlanRequest) => generatePlan(payload),
    onSuccess: () => invalidateMany(qc, INVALIDATE),
  });
}
