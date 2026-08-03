import { useQuery } from "@tanstack/react-query";
import { loadAllSessions } from "@/services/session-loader";
import type { Session } from "@/types/session";

export function useSessions() {
  return useQuery<{ completed: Session[]; planned: Session[] }>({
    queryKey: ["sessions"],
    queryFn: loadAllSessions,
    staleTime: 1000 * 60 * 5,
  });
}