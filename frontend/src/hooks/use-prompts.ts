import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  setActivePrompt,
  duplicatePrompt,
} from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import { useAuth } from "@/components/auth/auth-context";
import type { AiPrompt } from "@/types/session";

export function promptsKey(tenantId: string | null) {
  return ["ai-prompts", tenantId];
}

// Al cambiar el prompt activo, el chat arranca contexto nuevo con el objetivo.
const CHAT_PROMPT_INVALIDATE = ["coach-chat"];

export function usePrompts() {
  const { activeTenantId } = useAuth();
  return useQuery<AiPrompt[]>({
    queryKey: promptsKey(activeTenantId),
    queryFn: fetchPrompts,
    staleTime: 1000 * 60 * 60,
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { name: string; content: string }) => createPrompt(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promptsKey(activeTenantId) });
      toast({ type: "success", title: "Prompt creado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "No se pudo crear el prompt", description: err.message });
    },
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ promptId, payload }: { promptId: string; payload: { name: string; content: string } }) =>
      updatePrompt(promptId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promptsKey(activeTenantId) });
      toast({ type: "success", title: "Prompt guardado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "No se pudo guardar el prompt", description: err.message });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (promptId: string) => deletePrompt(promptId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promptsKey(activeTenantId) });
      toast({ type: "success", title: "Prompt eliminado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "No se pudo eliminar el prompt", description: err.message });
    },
  });
}

export function useSetActivePrompt() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (promptId: string) => setActivePrompt(promptId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promptsKey(activeTenantId) });
      invalidateMany(qc, CHAT_PROMPT_INVALIDATE);
      toast({ type: "success", title: "Prompt activo para el chat" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "No se pudo activar el prompt", description: err.message });
    },
  });
}

export function useDuplicatePrompt() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (promptId: string) => duplicatePrompt(promptId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promptsKey(activeTenantId) });
      toast({ type: "success", title: "Prompt duplicado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "No se pudo duplicar el prompt", description: err.message });
    },
  });
}