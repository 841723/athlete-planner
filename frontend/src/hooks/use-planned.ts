import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlanned,
  createPlanned,
  updatePlanned,
  deletePlanned,
} from "@/services/api";
import type { PlannedSessionView, Session } from "@/types/session";

const INVALIDATE = ["sessions", "weekly", "stats", "charts", "planned"];

export function usePlanned() {
  return useQuery<PlannedSessionView[]>({
    queryKey: ["planned"],
    queryFn: fetchPlanned,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Session>) => createPlanned(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVALIDATE }),
  });
}

export function useUpdatePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Session> }) =>
      updatePlanned(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVALIDATE }),
  });
}

export function useDeletePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlanned(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVALIDATE }),
  });
}
