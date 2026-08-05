import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, updateProfile } from "@/services/api";
import { useToast } from "@/components/ui/toast";

export function useProfile() {
  return useQuery<Record<string, unknown>>({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (profile: Record<string, unknown>) => updateProfile(profile),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast({ type: "success", title: "Perfil guardado correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al guardar el perfil", description: err.message });
    },
  });
}
