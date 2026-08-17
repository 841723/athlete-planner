import { getProfileHistory, getProfileVersion, saveProfileVersion } from "../lib/profile-history.js";
import { getAthleteProfile, saveAthleteProfile } from "../lib/sessions.js";
import { sendJson, readBody, canManage } from "../lib/http.js";

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
  const out = JSON.parse(JSON.stringify(profile));
  delete out.nombre;
  delete out.goal;
  const d = out.datos_del_atleta;
  if (d && typeof d === "object") {
    if (d.datos_personales && typeof d.datos_personales === "object") {
      delete d.datos_personales.nombre;
    }
    delete d.objetivo;
    if (d.estado_fisico && typeof d.estado_fisico === "object") {
      delete d.estado_fisico.semanas_consecutivas;
    }
  }
  return out;
}

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
    const clean = sanitizeProfile(body);
    if (!clean || Object.keys(clean).length === 0) {
      return sendJson(c.res, 400, { error: "El perfil no puede estar vacío" });
    }
    saveAthleteProfile(c.tenantId, clean);
    saveProfileVersion(c.tenantId, clean, "user");
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
    const newVersionId = saveProfileVersion(c.tenantId, version.data, "user");
    return sendJson(c.res, 200, { ok: true, versionId: newVersionId, restoredFrom: version.id });
  });
}
