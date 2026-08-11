// API de administración global (superadmin). Solo accesible con sesión de Google
// de un usuario marcado como superadmin (users.is_superadmin / env ADMIN_EMAILS);
// nunca a través de API keys.
import { getDb } from "../lib/db.js";
import { PROVIDER_LIST } from "../lib/providers.js";
import { getGlobalSettings, updateGlobalSettings, getOpencodeBaseUrl, isProviderEnabled } from "../lib/global-settings.js";
import { listModels, getAuthStatus, connectAuth } from "../lib/opencode.js";
import { getCatalogModel, mergeModelsWithCatalog, upsertOpencodeModel, deleteOpencodeModel } from "../lib/opencode-catalog.js";
import { createAthlete } from "../lib/athletes.js";
import {
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  renameTenant,
} from "../lib/members.js";
import { sendJson, readBody, requireSuperAdmin } from "../lib/http.js";

const ALL_ROLES = new Set(["athlete", "admin", "visitor"]);

function gate(c) {
  requireSuperAdmin(c.user);
}

function tenantRow(t) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.created_at,
    ownerEmail: t.owner_email,
    ownerName: t.owner_name,
    membersCount: Number(t.members_count),
    completedCount: Number(t.completed_count),
    plannedCount: Number(t.planned_count),
  };
}

export function registerAdmin(router) {
  router.get("/api/admin/settings", (c) => {
    gate(c);
    const global = getGlobalSettings();
    return sendJson(c.res, 200, {
      ...global,
      providers: PROVIDER_LIST.map((p) => ({
        ...p,
        enabled: isProviderEnabled(p.id),
      })),
    });
  });

  router.put("/api/admin/settings", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    const global = updateGlobalSettings({
      enabledProviders: body?.enabledProviders,
      opencodeBaseUrl: body?.opencodeBaseUrl,
    });
    return sendJson(c.res, 200, {
      ...global,
      providers: PROVIDER_LIST.map((p) => ({
        ...p,
        enabled: isProviderEnabled(p.id),
      })),
    });
  });

  router.get("/api/admin/opencode/models", async (c) => {
    gate(c);
    try {
      const models = await listModels(getOpencodeBaseUrl());
      for (const model of models) {
        if (!getCatalogModel(model.id, "opencode")) {
          upsertOpencodeModel({
            modelId: model.id,
            name: model.name,
            providerId: model.providerID,
            enabled: false,
            inputPrice: null,
            outputPrice: null,
          });
        }
      }
      return sendJson(c.res, 200, {
        baseUrl: getOpencodeBaseUrl(),
        models: mergeModelsWithCatalog(models),
      });
    } catch (err) {
      return sendJson(c.res, 200, { baseUrl: getOpencodeBaseUrl(), models: [], error: err.message });
    }
  });

  router.get("/api/admin/opencode/auth", async (c) => {
    gate(c);
    try {
      return sendJson(c.res, 200, { baseUrl: getOpencodeBaseUrl(), providers: await getAuthStatus(getOpencodeBaseUrl()) });
    } catch (err) {
      return sendJson(c.res, 200, { baseUrl: getOpencodeBaseUrl(), providers: {}, error: err.message });
    }
  });

  router.put("/api/admin/opencode/auth/:providerID", async (c) => {
    gate(c);
    try {
      return sendJson(c.res, 200, await connectAuth(getOpencodeBaseUrl(), c.params.providerID, await readBody(c.req)));
    } catch (err) {
      return sendJson(c.res, err.status ?? 400, { error: err.message });
    }
  });

  router.put("/api/admin/opencode/models/:modelId", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    try {
      const model = upsertOpencodeModel({
        modelId: c.params.modelId,
        name: body?.name,
        providerId: body?.providerId,
        enabled: !!body?.enabled,
        inputPrice: body?.inputPrice,
        outputPrice: body?.outputPrice,
        currency: body?.currency,
      });
      return sendJson(c.res, 200, model);
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.delete("/api/admin/opencode/models/:modelId", (c) => {
    gate(c);
    if (!deleteOpencodeModel(c.params.modelId)) return sendJson(c.res, 404, { error: "Modelo no encontrado" });
    c.res.writeHead(204);
    return c.res.end();
  });

  router.get("/api/admin/tenants", (c) => {
    gate(c);
    const rows = getDb()
      .prepare(
        `SELECT t.id, t.name, t.slug, t.created_at,
                u.email AS owner_email, u.name AS owner_name,
                (SELECT COUNT(*) FROM tenant_members m WHERE m.tenant_id = t.id) AS members_count,
                (SELECT COUNT(*) FROM sessions s WHERE s.tenant_id = t.id AND s.kind = 'completed') AS completed_count,
                (SELECT COUNT(*) FROM sessions s WHERE s.tenant_id = t.id AND s.kind = 'planned') AS planned_count
         FROM tenants t
         LEFT JOIN tenant_members om ON om.tenant_id = t.id AND om.is_owner = 1
         LEFT JOIN users u ON u.id = om.user_id
         ORDER BY t.created_at`
      )
      .all()
      .map(tenantRow);
    return sendJson(c.res, 200, rows);
  });

  router.post("/api/admin/tenants", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    try {
      const athlete = createAthlete({
        name: body?.name,
        ownerEmail: body?.ownerEmail,
        slug: body?.slug,
        minDate: body?.minDate,
        profile: body?.profile ?? null,
      });
      return sendJson(c.res, 201, athlete);
    } catch (err) {
      return sendJson(c.res, err.status ?? 400, { error: err.message });
    }
  });

  router.put("/api/admin/tenants/:id/name", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    try {
      return sendJson(c.res, 200, renameTenant(c.params.id, body?.name));
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.get("/api/admin/tenants/:id/members", (c) => {
    gate(c);
    return sendJson(c.res, 200, listMembers(c.params.id));
  });

  router.post("/api/admin/tenants/:id/members", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    try {
      return sendJson(c.res, 201, addMember(c.params.id, { email: body?.email, role: body?.role }, ALL_ROLES));
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.put("/api/admin/tenants/:id/members/:userId", async (c) => {
    gate(c);
    const body = await readBody(c.req);
    try {
      updateMemberRole(c.params.id, c.params.userId, body?.role, ALL_ROLES);
      return sendJson(c.res, 200, { ok: true });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.delete("/api/admin/tenants/:id/members/:userId", (c) => {
    gate(c);
    try {
      removeMember(c.params.id, c.params.userId);
      c.res.writeHead(204);
      return c.res.end();
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });
}
