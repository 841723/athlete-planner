import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createManualSession, deleteSession } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { Session } from "@/types/session";

const INVALIDATE = ["sessions", "session", "weekly", "stats", "charts", "planned", "stats-records"];

export function useCreateManualSession() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: Partial<Session>) => createManualSession(payload),
    onSuccess: (result) => {
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: result.merged ? "Actividad guardada y plan actualizada" : "Actividad guardada correctamente" });
    },
    onError: (error: Error) => toast({ type: "error", title: "Error al guardar la actividad", description: error.message }),
  });
}

export function useDeleteManualSession() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Actividad eliminada" });
    },
    onError: (error: Error) => toast({ type: "error", title: "No se pudo eliminar la actividad", description: error.message }),
  });
}
