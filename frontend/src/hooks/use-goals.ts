import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGoals, updateGoals } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { RaceGoal } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useGoals() {
  const { activeTenantId } = useAuth();
  return useQuery<RaceGoal[]>({
    queryKey: ["goals", activeTenantId],
    queryFn: fetchGoals,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpdateGoals() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (goals: RaceGoal[]) => updateGoals(goals),
    onSuccess: () => {
      invalidateMany(qc, ["goals", "meta"]);
      toast({ type: "success", title: "Objetivos guardados correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al guardar los objetivos", description: err.message });
    },
  });
}
