import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCoachChat,
  sendCoachChat,
  cancelCoachChat,
  updateCoachChatInstructions,
  deleteCoachChatMessages,
} from "@/services/trainer";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/components/ui/toast";
import type { CoachChat, CoachChatReply, ChatMessage } from "@/types/session";

export function coachChatKey(tenantId: string | null) {
  return ["coach-chat", tenantId];
}

export const CHAT_INVALIDATE = ["planned", "sessions", "weekly", "charts"];

export function useCoachChat(enabled: boolean) {
  const { activeTenantId } = useAuth();
  return useQuery<CoachChat>({
    queryKey: coachChatKey(activeTenantId),
    queryFn: fetchCoachChat,
    enabled: enabled && !!activeTenantId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSendCoachChat() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation<
    CoachChatReply,
    Error,
    { message: string },
    { previous?: CoachChat | undefined }
  >({
    mutationFn: ({ message }) => sendCoachChat(message),
    onMutate: async ({ message }) => {
      const key = coachChatKey(activeTenantId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CoachChat>(key);
      const optimistic: ChatMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
        localStatus: "sending",
      };
      if (previous) {
        qc.setQueryData<CoachChat>(key, {
          ...previous,
          messages: [...previous.messages, optimistic],
        });
      }
      return { previous };
    },
    onSuccess: () => {
      // El POST responde de inmediato; la respuesta del entrenador llega luego
      // vía refetch/polling, así que solo refrescamos el hilo.
      void qc.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
    },
    onError: (err, _vars, context) => {
      // Si el servidor rechazó el mensaje (permisos, chat pendiente, etc.),
      // deshacemos el mensaje optimista para no mostrar algo que no se guardó.
      const key = coachChatKey(activeTenantId);
      if (context?.previous) {
        qc.setQueryData<CoachChat>(key, context.previous);
      } else {
        void qc.invalidateQueries({ queryKey: key });
      }
      toast({ type: "error", title: "Error al enviar el mensaje", description: err.message });
    },
  });
}

export function useCancelCoachChat() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation<void, Error>({
    mutationFn: () => cancelCoachChat().then(() => undefined),
    onSuccess: () => {
      // La cancelación deja chat_pending en false; el componente reacciona al
      // cambio y refresca el hilo con el toast correspondiente.
      void qc.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al cancelar la respuesta", description: err.message });
    },
  });
}

export function useUpdateCoachChatInstructions() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ instructions }: { instructions: string }) => updateCoachChatInstructions(instructions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
      void qc.invalidateQueries({ queryKey: ["coach-chat"] });
      toast({ type: "success", title: "Instrucciones del chat guardadas" });
    },
    onError: (err: Error) => toast({ type: "error", title: "No se pudieron guardar las instrucciones", description: err.message }),
  });
}

export function useDeleteCoachChatMessages() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (ids: string[]) => deleteCoachChatMessages(ids),
    onSuccess: ({ deletedIds }) => {
      void qc.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
      toast({ type: "success", title: `${deletedIds.length} mensaje${deletedIds.length === 1 ? "" : "s"} eliminado${deletedIds.length === 1 ? "" : "s"}` });
    },
    onError: (err: Error) => toast({ type: "error", title: "No se pudieron eliminar los mensajes", description: err.message }),
  });
}
