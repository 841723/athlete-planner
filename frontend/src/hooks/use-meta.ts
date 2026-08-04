import { useQuery } from "@tanstack/react-query";
import { fetchMeta } from "@/services/api";
import type { MetaData } from "@/types/session";

export function useMeta() {
  return useQuery<MetaData>({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    staleTime: 1000 * 60 * 60,
  });
}
