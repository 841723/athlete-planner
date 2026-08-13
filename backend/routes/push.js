import { sendJson, readBody, canWrite } from "../lib/http.js";
import { deleteSubscription, getPushConfig, listSubscriptions, saveSubscription } from "../lib/push.js";

export function register(router) {
  router.get("/api/push/config", (c) => sendJson(c.res, 200, getPushConfig()));
  router.get("/api/push/subscriptions", (c) => {
    if (!c.user) return sendJson(c.res, 403, { error: "Las notificaciones push requieren una sesión de usuario" });
    return sendJson(c.res, 200, listSubscriptions(c.tenantId));
  });

  router.post("/api/push/subscriptions", async (c) => {
    if (!c.user) return sendJson(c.res, 403, { error: "Las notificaciones push requieren una sesión de usuario" });
    const body = await readBody(c.req);
    try {
      saveSubscription(c.tenantId, c.user?.id ?? null, body);
      return sendJson(c.res, 201, { ok: true });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.delete("/api/push/subscriptions", async (c) => {
    if (!canWrite(c.membership) || !c.user) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (typeof body?.endpoint !== "string" || !body.endpoint) {
      return sendJson(c.res, 400, { error: "Falta endpoint" });
    }
    deleteSubscription(c.tenantId, body.endpoint);
    c.res.writeHead(204);
    return c.res.end();
  });
}
