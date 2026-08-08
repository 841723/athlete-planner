import { getProfileHistory, getProfileVersion, saveProfileVersion } from "../lib/profile-history.js";
import { getAthleteProfile, saveAthleteProfile } from "../lib/sessions.js";
import { sendJson, readBody, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/profile", (c) => {
    return sendJson(c.res, 200, getAthleteProfile(c.tenantId) ?? {});
  });

  router.put("/api/profile", async (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
      return sendJson(c.res, 400, { error: "El perfil no puede estar vacío" });
    }
    saveAthleteProfile(c.tenantId, body);
    saveProfileVersion(c.tenantId, body, "user");
    return sendJson(c.res, 200, { ok: true });
  });

  router.get("/api/profile/history", (c) => {
    return sendJson(c.res, 200, getProfileHistory(c.tenantId));
  });

  router.get("/api/profile/history/:versionId", (c) => {
    const version = getProfileVersion(c.params.versionId);
    if (!version || version.tenant_id !== c.tenantId) {
      return sendJson(c.res, 404, { error: "Versión no encontrada" });
    }
    return sendJson(c.res, 200, version);
  });

  router.put("/api/profile/active", async (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body?.versionId) return sendJson(c.res, 400, { error: "Falta versionId" });
    const version = getProfileVersion(body.versionId);
    if (!version || version.tenant_id !== c.tenantId) {
      return sendJson(c.res, 404, { error: "Versión no encontrada" });
    }
    saveAthleteProfile(c.tenantId, version.data);
    return sendJson(c.res, 200, { ok: true });
  });
}
