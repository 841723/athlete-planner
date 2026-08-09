import { useQuery } from "@tanstack/react-query";
import { fetchAiLogs } from "@/services/api";
import type { AiLogsPage } from "@/types/session";

export function useAiLogs(options: {
  limit?: number;
  offset?: number;
  ok?: "ok" | "error";
  provider?: string;
} = {}) {
  return useQuery<AiLogsPage>({
    queryKey: ["ai-logs", options.limit ?? 50, options.offset ?? 0, options.ok ?? null, options.provider ?? null],
    queryFn: () => fetchAiLogs(options),
  });
}
