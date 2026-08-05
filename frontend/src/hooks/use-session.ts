import { useQuery } from "@tanstack/react-query";
import { fetchSession } from "@/services/api";
import type { Session } from "@/types/session";

export function useSession(id: string | undefined) {
  return useQuery<Session>({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
