import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncGarmin } from "@/services/api";
import { invalidateMany } from "@/lib/invalidate";
import type { SyncResult } from "@/types/session";

const INVALIDATE = ["sessions", "weekly", "stats", "charts", "planned", "stats-records"];

export function useGarminSync() {
  const qc = useQueryClient();
  return useMutation<SyncResult, Error, void>({
    mutationFn: () => syncGarmin(),
    onSuccess: () => invalidateMany(qc, INVALIDATE),
  });
}
