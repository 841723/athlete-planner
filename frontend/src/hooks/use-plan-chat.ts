import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlanChat, sendPlanChat, deletePlanChat, cancelPlanChat } from "@/services/trainer";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { PlanChat, PlanChatReply, PlanMessage } from "@/types/session";

export function planChatKey(planId: string) {
  return ["plan-chat", planId];
}

export const CHAT_INVALIDATE = ["planned", "plans", "sessions", "weekly", "charts"];

export function usePlanChat(planId: string, enabled: boolean) {
  return useQuery<PlanChat>({
    queryKey: planChatKey(planId),
    queryFn: () => fetchPlanChat(planId),
    enabled,
    staleTime: 0,
    // Mientras el entrenador está generando la respuesta (p. ej. tras recargar
    // la página), se actualiza el hilo para mostrar la respuesta al llegar.
    refetchInterval: (query) => (query.state.data?.chatPending ? 2000 : false),
  });
}

export function useSendPlanChat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<
    PlanChatReply,
    Error,
    { planId: string; message: string },
    { previous?: PlanChat | undefined }
  >({
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
      return { previous };
    },
    onSuccess: (_data, vars) => {
      // El POST responde de inmediato; la respuesta del entrenador llega luego
      // vía refetch/polling, así que solo refrescamos el hilo.
      void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
    },
    onError: (err, vars, context) => {
      // Si el servidor rechazó el mensaje (permisos, plan en generación, etc.),
      // deshacemos el mensaje optimista para no mostrar algo que no se guardó.
      if (context?.previous) {
        qc.setQueryData<PlanChat>(planChatKey(vars.planId), context.previous);
      } else {
        void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
      }
      toast({ type: "error", title: "Error al enviar el mensaje", description: err.message });
    },
  });
}

export function useCancelPlanChat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<void, Error, { planId: string }>({
    mutationFn: ({ planId }) => cancelPlanChat(planId).then(() => undefined),
    onSuccess: (_data, vars) => {
      // La cancelación deja chat_pending en false; el componente reacciona al
      // cambio y refresca el hilo con el toast correspondiente.
      void qc.invalidateQueries({ queryKey: planChatKey(vars.planId) });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al cancelar la respuesta", description: err.message });
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
      invalidateMany(qc, CHAT_INVALIDATE);
      toast({ type: "success", title: "Plan y chat eliminados correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al eliminar el plan", description: err.message });
    },
  });
}
