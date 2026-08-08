import { listAiLogs } from "../lib/ai-logs.js";
import { sendJson, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/ai-logs", (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const url = new URL(c.req.url, "http://localhost");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    return sendJson(c.res, 200, listAiLogs(c.tenantId, limit));
  });
}
