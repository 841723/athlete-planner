import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApiKeys, createApiKey, deleteApiKey } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import type { ApiKey } from "@/types/session";

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { name: string; role: "admin" | "visitor" }) => createApiKey(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al crear la API key", description: err.message });
    },
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al eliminar la API key", description: err.message });
    },
  });
}
