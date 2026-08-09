import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSyncSources,
  garminConnect,
  garminMfa,
  stravaConnect,
  disconnectSyncSource,
  updateSyncSourceConfig,
} from "@/services/api";
import type { SyncSource } from "@/types/session";

export function useSyncSources() {
  return useQuery({
    queryKey: ["sync-sources"],
    queryFn: fetchSyncSources,
  });
}

export function useSyncSourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sync-sources"] });

  return {
    garminConnect: useMutation({
      mutationFn: (body: { email: string; password: string }) => garminConnect(body),
      onSuccess: invalidate,
    }),
    garminMfa: useMutation({
      mutationFn: (body: { email: string; password: string; code: string }) => garminMfa(body),
      onSuccess: invalidate,
    }),
    stravaConnect: useMutation({
      mutationFn: () => stravaConnect(),
    }),
    disconnect: useMutation({
      mutationFn: (provider: string) => disconnectSyncSource(provider),
      onSuccess: invalidate,
    }),
    updateConfig: useMutation({
      mutationFn: (body: { provider: string; min_date?: string | null }) =>
        updateSyncSourceConfig(body.provider, { min_date: body.min_date }),
      onSuccess: invalidate,
    }),
  };
}

export function syncSourceById(items: SyncSource[] | undefined, provider: string): SyncSource | undefined {
  return items?.find((s) => s.provider === provider);
}
