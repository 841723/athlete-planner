import { listMembers, addMember, updateMemberRole, removeMember } from "../lib/members.js";
import { sendJson, readBody, requireMember, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/tenants/:id/members", (c) => {
    requireMember(c.params.id, c.user);
    return sendJson(c.res, 200, listMembers(c.params.id));
  });

  router.post("/api/tenants/:id/members", async (c) => {
    const membership = requireMember(c.params.id, c.user);
    if (!canManage(membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    return sendJson(c.res, 201, addMember(c.params.id, body ?? {}));
  });

  router.put("/api/tenants/:id/members/:userId", async (c) => {
    const membership = requireMember(c.params.id, c.user);
    if (!canManage(membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    updateMemberRole(c.params.id, c.params.userId, body?.role);
    return sendJson(c.res, 200, { ok: true });
  });

  router.delete("/api/tenants/:id/members/:userId", (c) => {
    const membership = requireMember(c.params.id, c.user);
    if (!canManage(membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    removeMember(c.params.id, c.params.userId);
    c.res.writeHead(204);
    return c.res.end();
  });
}
