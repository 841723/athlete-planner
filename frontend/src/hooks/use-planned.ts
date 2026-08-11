import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlanned,
  createPlanned,
  updatePlanned,
  deletePlanned,
} from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { invalidateMany } from "@/lib/invalidate";
import type { PlannedSessionView, Session } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

const INVALIDATE = ["sessions", "session", "weekly", "stats", "charts", "planned", "stats-records", "plan-detail", "plans"];

export function usePlanned() {
  const { activeTenantId } = useAuth();
  return useQuery<PlannedSessionView[]>({
    queryKey: ["planned", activeTenantId],
    queryFn: fetchPlanned,
    enabled: !!activeTenantId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePlanned() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: Partial<Session>) => createPlanned(payload),
    onSuccess: () => {
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Sesión creada correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al crear la sesión", description: err.message });
    },
  });
}

export function useUpdatePlanned() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Session> }) =>
      updatePlanned(id, payload),
    onSuccess: () => {
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Sesión actualizada correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al actualizar la sesión", description: err.message });
    },
  });
}

export function useDeletePlanned() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => deletePlanned(id),
    onSuccess: () => {
      invalidateMany(qc, INVALIDATE);
      toast({ type: "success", title: "Sesión eliminada correctamente" });
    },
    onError: (err) => {
      toast({ type: "error", title: "Error al eliminar la sesión", description: err.message });
    },
  });
}
