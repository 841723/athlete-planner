import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlanChat, sendPlanChat, deletePlanChat } from "@/services/trainer";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { PlanChat, PlanChatReply, PlanMessage } from "@/types/session";

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
  return useMutation<PlanChatReply, Error, { planId: string; message: string }, { optimisticId: string }>({
    mutationFn: ({ planId, message }) => sendPlanChat(planId, message),
    onMutate: async ({ planId, message }) => {
      await qc.cancelQueries({ queryKey: planChatKey(planId) });
      const previous = qc.getQueryData<PlanChat>(planChatKey(planId));
      const optimistic: PlanMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        plan_id: planId,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
        localStatus: "sending",
      };
      if (previous) {
        qc.setQueryData<PlanChat>(planChatKey(planId), {
          ...previous,
          messages: [...previous.messages, optimistic],
        });
      }
      return { optimisticId: optimistic.id };
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "El entrenador ha respondido" });
    },
    onError: (err, vars, context) => {
      if (context?.optimisticId) {
        const current = qc.getQueryData<PlanChat>(planChatKey(vars.planId));
        if (current) {
          qc.setQueryData<PlanChat>(planChatKey(vars.planId), {
            ...current,
            messages: current.messages.map((message) =>
              message.id === context.optimisticId ? { ...message, localStatus: "failed" } : message
            ),
          });
        }
      }
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
