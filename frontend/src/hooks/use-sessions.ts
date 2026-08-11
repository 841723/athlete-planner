import { useQuery } from "@tanstack/react-query";
import { fetchSessions } from "@/services/api";
import type { SessionsResponse } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useSessions() {
  const { activeTenantId } = useAuth();
  return useQuery<SessionsResponse>({
    queryKey: ["sessions", activeTenantId],
    queryFn: fetchSessions,
    staleTime: 1000 * 60 * 5,
  });
}
