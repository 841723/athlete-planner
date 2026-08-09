import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMeta, updateMeta } from "@/services/api";
import type { MetaData, MetaPayload } from "@/types/session";

export function useMeta() {
  return useQuery<MetaData>({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient();
  return useMutation<MetaData, Error, Partial<MetaPayload>>({
    mutationFn: (payload) => updateMeta(payload),
    onSuccess: (data) => {
      qc.setQueryData(["meta"], data);
    },
  });
}
