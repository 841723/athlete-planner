import { useQuery } from "@tanstack/react-query";
import { fetchSession } from "@/services/api";
import type { Session } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useSession(id: string | undefined) {
  const { activeTenantId } = useAuth();
  return useQuery<Session>({
    queryKey: ["session", activeTenantId, id],
    queryFn: () => fetchSession(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
