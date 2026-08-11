import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEquipment, saveEquipment } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import type { EquipmentItem, EquipmentCategory, EquipmentResponse } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useEquipment() {
  const { activeTenantId } = useAuth();
  return useQuery<EquipmentResponse>({
    queryKey: ["equipment", activeTenantId],
    queryFn: fetchEquipment,
    staleTime: 1000 * 60 * 60,
  });
}

export function useSaveEquipment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: { items: EquipmentItem[]; catalog?: EquipmentCategory[] }) => saveEquipment(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["equipment"] });
      toast({ type: "success", title: "Equipamiento guardado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al guardar el equipamiento", description: err.message });
    },
  });
}
