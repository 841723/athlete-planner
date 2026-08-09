import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generatePlan, regeneratePlan } from "@/services/trainer";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { GeneratePlanRequest, Plan } from "@/types/session";

const INVALIDATE = ["sessions", "weekly", "stats", "charts", "planned", "stats-records", "profile", "profile-history", "plans"];

export function useGeneratePlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<Plan, Error, GeneratePlanRequest>({
    mutationFn: (payload: GeneratePlanRequest) => generatePlan(payload),
    onSuccess: (plan) => {
      invalidateMany(qc, INVALIDATE);
      toast({
        type: "success",
        title: "Plan en generación",
        description: plan.weeks > 1 ? `Se generará un plan de ${plan.weeks} semanas.` : "La IA está preparando tu plan. Lo verás aquí cuando termine.",
      });
    },
    onError: (err) => {
      toast({ type: "error", title: "No se pudo iniciar la generación", description: err.message });
    },
  });
}

export function useRetryPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<Plan, Error, string>({
    mutationFn: (planId: string) => regeneratePlan(planId),
    onSuccess: (plan) => {
      invalidateMany(qc, INVALIDATE);
      toast({
        type: "success",
        title: "Reintentando generación",
        description: plan.weeks > 1 ? `Se generará un plan de ${plan.weeks} semanas.` : "La IA está preparando tu plan. Lo verás aquí cuando termine.",
      });
    },
    onError: (err) => {
      toast({ type: "error", title: "No se pudo reintentar", description: err.message });
    },
  });
}
