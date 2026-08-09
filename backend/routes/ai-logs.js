import { listAiLogs } from "../lib/ai-logs.js";
import { getDefaultAiConfig } from "../lib/ai-configs.js";
import { sendJson, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/ai-logs", (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const url = new URL(c.req.url, "http://localhost");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const ok = url.searchParams.get("ok") ?? null;
    const provider = url.searchParams.get("provider") ?? null;

    const result = listAiLogs(c.tenantId, { limit, offset, ok, provider });
    const config = getDefaultAiConfig(c.tenantId);
    const currency =
      result.items.find((l) => l.currency)?.currency ?? config?.currency ?? "EUR";

    return sendJson(c.res, 200, { ...result, currency });
  });
}
