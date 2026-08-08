import { getGoals, saveGoals } from "../lib/goals.js";
import { getMeta } from "../lib/meta.js";
import { sendJson, readBody, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/goals", (c) => {
    return sendJson(c.res, 200, getGoals(c.tenantId));
  });

  router.put("/api/goals", async (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    saveGoals(c.tenantId, body?.goals);
    return sendJson(c.res, 200, { ok: true });
  });

  router.get("/api/meta", (c) => {
    return sendJson(c.res, 200, getMeta(c.tenantId));
  });
}
