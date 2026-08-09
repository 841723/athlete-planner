import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPrompts, savePrompt, deletePrompt, updatePrompt } from "@/services/trainer";
import { useToast } from "@/components/ui/toast";

export function usePrompts() {
  return useQuery({
    queryKey: ["prompts"],
    queryFn: fetchPrompts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePrompt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: savePrompt,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      toast({ type: "success", title: "Prompt guardado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al guardar", description: err.message });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: deletePrompt,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      toast({ type: "success", title: "Prompt eliminado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al eliminar", description: err.message });
    },
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ promptId, payload }: { promptId: string; payload: { name: string; content: string } }) =>
      updatePrompt(promptId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      toast({ type: "success", title: "Prompt actualizado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al actualizar", description: err.message });
    },
  });
}
