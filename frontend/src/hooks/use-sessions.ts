import { useQuery } from "@tanstack/react-query";
import { fetchSessions } from "@/services/api";
import type { SessionsResponse } from "@/types/session";

export function useSessions() {
  return useQuery<SessionsResponse>({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    staleTime: 1000 * 60 * 5,
  });
}
