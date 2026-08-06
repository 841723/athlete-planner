import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProfileHistory,
  fetchProfileVersion,
  setActiveProfileVersion,
} from "@/services/api";
import { useToast } from "@/components/ui/toast";

export function useProfileHistory() {
  return useQuery({
    queryKey: ["profile-history"],
    queryFn: fetchProfileHistory,
    staleTime: 60 * 1000,
  });
}

export function useProfileVersion(versionId: string | null) {
  return useQuery({
    queryKey: ["profile-version", versionId],
    queryFn: () => fetchProfileVersion(versionId!),
    enabled: !!versionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetActiveProfileVersion() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: setActiveProfileVersion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-history"] });
      toast({ type: "success", title: "Perfil activo actualizado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al cambiar perfil", description: err.message });
    },
  });
}
