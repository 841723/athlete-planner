import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlanChat, sendPlanChat, deletePlanChat } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { PlanChat, PlanChatReply } from "@/types/session";

export function planChatKey(planId: string) {
  return ["plan-chat", planId];
}

const INVALIDATE = ["planned", "plans", "sessions", "weekly", "charts"];

export function usePlanChat(planId: string, enabled: boolean) {
  return useQuery<PlanChat>({
    queryKey: planChatKey(planId),
    queryFn: () => fetchPlanChat(planId),
    enabled,
    staleTime: 0,
  });
}

export function useSendPlanChat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<PlanChatReply, Error, { planId: string; message: string }>({
    mutationFn: ({ planId, message }) => sendPlanChat(planId, message),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
      invalidateMany(qc, INVALIDATE);
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al enviar el mensaje", description: err.message });
    },
  });
}

export function useDeletePlanChat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<void, Error, { planId: string }>({
    mutationFn: ({ planId }) => deletePlanChat(planId),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Plan y chat eliminados correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al eliminar el plan", description: err.message });
    },
  });
}
