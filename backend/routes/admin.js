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

  router.get("/api/admin/sync/jobs", (c) => {
    gate(c);
    const params = [];
    const filters = [];
    const tenant = c.url.searchParams.get("tenant");
    const status = c.url.searchParams.get("status");
    const type = c.url.searchParams.get("type");
    const from = c.url.searchParams.get("from");
    const to = c.url.searchParams.get("to");
    if (tenant) { filters.push("j.tenant_id = ?"); params.push(tenant); }
    if (status) { filters.push("j.status = ?"); params.push(status); }
    if (type) { filters.push("j.type = ?"); params.push(type); }
    if (from) { filters.push("j.created_at >= ?"); params.push(from); }
    if (to) { filters.push("j.created_at <= ?"); params.push(to); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = getDb().prepare(
      `SELECT j.*, t.name AS tenant_name, t.slug AS tenant_slug
       FROM jobs j JOIN tenants t ON t.id = j.tenant_id
       ${where} ORDER BY j.created_at DESC LIMIT 200`
    ).all(...params);
    return sendJson(c.res, 200, rows.map((row) => ({
      ...row,
      payload: null,
      result: row.result ? JSON.parse(row.result) : null,
      progress: row.progress ? JSON.parse(row.progress) : null,
    })));
  });

  router.get("/api/admin/ai-usage/summary", (c) => {
    gate(c);
    const params = [];
    const filters = [];
    const tenant = c.url.searchParams.get("tenant");
    const provider = c.url.searchParams.get("provider");
    const model = c.url.searchParams.get("model");
    const from = c.url.searchParams.get("from");
    const to = c.url.searchParams.get("to");
    if (tenant) { filters.push("l.tenant_id = ?"); params.push(tenant); }
    if (provider) { filters.push("l.provider = ?"); params.push(provider); }
    if (model) { filters.push("l.model = ?"); params.push(model); }
    if (from) { filters.push("l.created_at >= ?"); params.push(from); }
    if (to) { filters.push("l.created_at <= ?"); params.push(to); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = getDb().prepare(
      `SELECT l.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              l.provider, l.model, l.currency,
              COUNT(*) AS calls, SUM(COALESCE(l.input_tokens, 0)) AS input_tokens,
              SUM(COALESCE(l.output_tokens, 0)) AS output_tokens,
              SUM(COALESCE(l.cost, 0)) AS cost, SUM(CASE WHEN l.ok = 1 THEN 1 ELSE 0 END) AS ok,
              SUM(CASE WHEN l.ok = 0 THEN 1 ELSE 0 END) AS errors
       FROM ai_logs l JOIN tenants t ON t.id = l.tenant_id
       ${where}
       GROUP BY l.tenant_id, l.provider, l.model, l.currency
       ORDER BY cost DESC`
    ).all(...params);
    return sendJson(c.res, 200, rows);
  });

  router.get("/api/admin/ai-logs", (c) => {
    gate(c);
    const params = [];
    const filters = [];
    const tenant = c.url.searchParams.get("tenant");
    const provider = c.url.searchParams.get("provider");
    const model = c.url.searchParams.get("model");
    const ok = c.url.searchParams.get("ok");
    if (tenant) { filters.push("l.tenant_id = ?"); params.push(tenant); }
    if (provider) { filters.push("l.provider = ?"); params.push(provider); }
    if (model) { filters.push("l.model = ?"); params.push(model); }
    if (ok === "ok" || ok === "error") { filters.push("l.ok = ?"); params.push(ok === "ok" ? 1 : 0); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = getDb().prepare(
      `SELECT l.id, l.tenant_id, t.name AS tenant_name, l.user_id, l.auth_method,
              l.actor, l.operation_type, l.provider, l.model, l.endpoint, l.status, l.ok, l.duration_ms,
              l.input_tokens, l.output_tokens, l.cost, l.currency, l.created_at
       FROM ai_logs l JOIN tenants t ON t.id = l.tenant_id
       ${where} ORDER BY l.created_at DESC LIMIT 200`
    ).all(...params);
    return sendJson(c.res, 200, rows);
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
