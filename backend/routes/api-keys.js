import { generateApiKey, listApiKeys, revokeApiKey } from "../lib/api-keys.js";
import { sendJson, readBody, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/api-keys", (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    return sendJson(c.res, 200, listApiKeys(c.tenantId));
  });

  router.post("/api/api-keys", async (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const raw = generateApiKey(c.tenantId, {
      name: body?.name,
      role: body?.role ?? "admin",
      createdBy: c.user?.id ?? null,
    });
    return sendJson(c.res, 201, { apiKey: raw });
  });

  router.delete("/api/api-keys/:id", (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const deleted = revokeApiKey(c.tenantId, c.params.id);
    if (!deleted) return sendJson(c.res, 404, { error: "API key no encontrada" });
    c.res.writeHead(204);
    return c.res.end();
  });
}
