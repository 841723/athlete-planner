import { useQuery } from "@tanstack/react-query";
import { fetchAiLogs } from "@/services/api";
import type { AiLog } from "@/types/session";

export function useAiLogs(limit = 50) {
  return useQuery<AiLog[]>({
    queryKey: ["ai-logs", limit],
    queryFn: () => fetchAiLogs(limit),
  });
}
