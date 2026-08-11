import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAiSettings,
  updateAiSettings,
  testAiSettings,
} from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";

export function useAiSettings() {
  const { activeTenantId } = useAuth();
  return useQuery({
    queryKey: ["ai-settings", activeTenantId],
    queryFn: fetchAiSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: updateAiSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast({ type: "success", title: "Configuración de IA guardada" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al guardar", description: err.message });
    },
  });
}

export function useTestAiSettings() {
  return useMutation({
    mutationFn: testAiSettings,
  });
}
