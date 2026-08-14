import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSession } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { Session } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

const INVALIDATE = ["sessions", "session", "weekly", "stats", "charts", "planned"];

export function useUpdateSession() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation<Session, Error, { id: string; payload: Partial<Session> }>({
    mutationFn: ({ id, payload }) => updateSession(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(["session", activeTenantId, updated.id], updated);
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Notas guardadas correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al guardar las notas", description: err.message });
    },
  });
}
