import { useQuery } from "@tanstack/react-query";
import { fetchAiLogs } from "@/services/api";
import type { AiLogsPage } from "@/types/session";
import { useAuth } from "@/components/auth/auth-context";

export function useAiLogs(options: {
  limit?: number;
  offset?: number;
  ok?: "ok" | "error";
  provider?: string;
} = {}) {
  const { activeTenantId } = useAuth();
  return useQuery<AiLogsPage>({
    queryKey: ["ai-logs", activeTenantId, options.limit ?? 50, options.offset ?? 0, options.ok ?? null, options.provider ?? null],
    queryFn: () => fetchAiLogs(options),
  });
}
