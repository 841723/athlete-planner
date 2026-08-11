import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMeta, updateMeta } from "@/services/api";
import type { MetaData, MetaPayload } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useMeta() {
  const { activeTenantId } = useAuth();
  return useQuery<MetaData>({
    queryKey: ["meta", activeTenantId],
    queryFn: fetchMeta,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  return useMutation<MetaData, Error, Partial<MetaPayload>>({
    mutationFn: (payload) => updateMeta(payload),
    onSuccess: (data) => {
      qc.setQueryData(["meta", activeTenantId], data);
    },
  });
}
