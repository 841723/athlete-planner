import http from "node:http";
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile();
} catch {
  // No .env (p.ej. variables ya exportadas); continuar.
}
import {
  loadAllSessions,
  getSessionTime,
  getSession,
  updateSession,
  withTenant,
  getTenantId,
  getAthleteProfile,
  saveAthleteProfile,
} from "./lib/sessions.js";
import { buildWeeklySummary } from "./lib/weekly.js";
import { buildStats } from "./lib/stats.js";
import { buildCharts } from "./lib/charts.js";
import { getGoals, saveGoals } from "./lib/goals.js";
import { getMeta } from "./lib/meta.js";
import { listPlanned, createPlanned, updatePlanned, deletePlanned } from "./lib/planned.js";
import { generatePlan } from "./lib/trainer.js";
import { buildStatsRecords } from "./lib/stats-records.js";
import { runSync } from "./lib/sync.js";
import { migrate } from "./lib/migrate.js";
import {
  AUTH_COOKIE,
  TENANT_COOKIE,
  verifyGoogleToken,
  findOrCreateUser,
  createSessionToken,
  getUserByToken,
  destroySessionToken,
  getTenantMemberships,
  getMembership,
  publicUser,
} from "./lib/auth.js";
import { listMembers, addMember, updateMemberRole, removeMember, renameTenant } from "./lib/members.js";
import { getAiSettings, getAiSettingsWithKey, saveAiSettings } from "./lib/ai-settings.js";
import { getProfileHistory, getProfileVersion, saveProfileVersion } from "./lib/profile-history.js";
import { getPrompts, getPrompt, savePrompt, deletePrompt } from "./lib/ai-prompts.js";

const args = process.argv.slice(2);
const portArg = Number(process.env.PORT ?? 4000);
let port = portArg;
let staticDir = process.env.STATIC_DIR ?? null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") port = Number(args[++i]);
  else if (args[i] === "--static") {
    const next = args[i + 1];
    staticDir = next && !next.startsWith("--") ? path.resolve(import.meta.dirname, "..", next) : path.resolve(import.meta.dirname, "..", "frontend", "dist");
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, err) {
  const status = err.status ?? 500;
  sendJson(res, status, { error: err.message ?? "Error interno" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let raw = "";
    req.on("data", (chunk) => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 1_000_000) {
        settled = true;
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("JSON inválido"), { status: 400 }));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setCookie(res, name, value, maxAge) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res) {
  if (!staticDir || !fs.existsSync(staticDir)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No se ha configurado directorio estático (--static)");
    return;
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    urlPath = "/";
  }
  let filePath = path.join(staticDir, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(staticDir)) filePath = path.join(staticDir, "index.html");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticDir, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Archivo no encontrado");
  }
}

function requireMember(tenantId, user) {
  const membership = getMembership(tenantId, user.id);
  if (!membership) {
    const err = new Error("Sin acceso a este tenant");
    err.status = 403;
    throw err;
  }
  return membership;
}

function requireRole(membership, roles) {
  if (!roles.includes(membership.role)) {
    const err = new Error("No tienes permisos para esta acción");
    err.status = 403;
    throw err;
  }
}

const canWrite = (m) => m.role !== "visitor";
const canManage = (m) => m.role === "admin" || m.role === "athlete";

async function handleTenantRoutes(req, res, url, method, user, membership) {
  const tenantId = getTenantId();

  if (url.pathname === "/api/sessions" && method === "GET") {
    const { completed, planned } = loadAllSessions();
    const totals = completed.reduce(
      (acc, s) => {
        acc.totalDistance += s.distance_m ?? 0;
        acc.totalHours += getSessionTime(s) / 3600;
        acc.totalSessions += 1;
        return acc;
      },
      { totalDistance: 0, totalHours: 0, totalSessions: 0 }
    );
    const totalsCompleted = completed.reduce(
      (acc, s) => {
        acc.totalDistance += s.distance_m ?? 0;
        acc.totalHours += getSessionTime(s) / 3600;
        return acc;
      },
      { totalDistance: 0, totalHours: 0 }
    );
    return sendJson(res, 200, { completed, planned, totals, totalsCompleted });
  }

  if (url.pathname === "/api/weekly" && method === "GET") {
    const { completed } = loadAllSessions();
    return sendJson(res, 200, buildWeeklySummary(completed));
  }

  if (url.pathname === "/api/stats" && method === "GET") {
    const { completed } = loadAllSessions();
    return sendJson(res, 200, buildStats(completed));
  }

  if (url.pathname === "/api/stats-records" && method === "GET") {
    const { completed } = loadAllSessions();
    return sendJson(res, 200, buildStatsRecords(completed));
  }

  if (url.pathname === "/api/charts" && method === "GET") {
    const { completed } = loadAllSessions();
    const weekly = buildWeeklySummary(completed);
    return sendJson(res, 200, buildCharts(completed, weekly));
  }

  if (url.pathname === "/api/goals" && method === "GET") {
    return sendJson(res, 200, getGoals(tenantId));
  }

  if (url.pathname === "/api/goals" && method === "PUT") {
    if (!canManage(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    saveGoals(tenantId, body?.goals);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/meta" && method === "GET") {
    return sendJson(res, 200, getMeta(tenantId));
  }

  if (url.pathname === "/api/planned") {
    if (method === "GET") return sendJson(res, 200, listPlanned());
    if (method === "POST") {
      if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
      const body = await readBody(req);
      return sendJson(res, 201, createPlanned(body ?? {}));
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const plannedMatch = url.pathname.match(/^\/api\/planned\/([^/]+)$/);
  if (plannedMatch) {
    const id = decodeURIComponent(plannedMatch[1]);
    if (method === "PUT") {
      if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
      const body = await readBody(req);
      return sendJson(res, 200, updatePlanned(id, body ?? {}));
    }
    if (method === "DELETE") {
      if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
      deletePlanned(id);
      res.writeHead(204);
      return res.end();
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  if (url.pathname === "/api/generate-plan" && method === "POST") {
    if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    const comments = body?.comments ?? "";
    const weeks = body?.weeks ?? 1;
    const profileVersionId = body?.profileVersionId ?? null;
    const promptId = body?.promptId ?? null;
    const settings = getAiSettingsWithKey(tenantId);
    if (!settings) return sendJson(res, 400, { error: "Configura un proveedor de IA en Configuración antes de generar un plan." });
    const result = await generatePlan({
      comments,
      weeks,
      profileVersionId,
      promptId,
      apiKey: settings.api_key,
      provider: settings.provider,
      model: settings.model,
    });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/sync" && method === "POST") {
    if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    const result = await runSync({ force: body?.force === true });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/profile" && method === "GET") {
    return sendJson(res, 200, getAthleteProfile(tenantId) ?? {});
  }

  if (url.pathname === "/api/profile" && method === "PUT") {
    if (!canManage(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    saveAthleteProfile(tenantId, body ?? {});
    saveProfileVersion(tenantId, body ?? {}, "user");
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/profile/history" && method === "GET") {
    return sendJson(res, 200, getProfileHistory(tenantId));
  }

  const profileHistoryMatch = url.pathname.match(/^\/api\/profile\/history\/([^/]+)$/);
  if (profileHistoryMatch && method === "GET") {
    const versionId = decodeURIComponent(profileHistoryMatch[1]);
    const version = getProfileVersion(versionId);
    if (!version || version.tenant_id !== tenantId) return sendJson(res, 404, { error: "Versión no encontrada" });
    return sendJson(res, 200, version);
  }

  if (url.pathname === "/api/profile/active" && method === "PUT") {
    if (!canManage(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    if (!body?.versionId) return sendJson(res, 400, { error: "Falta versionId" });
    const version = getProfileVersion(body.versionId);
    if (!version || version.tenant_id !== tenantId) return sendJson(res, 404, { error: "Versión no encontrada" });
    saveAthleteProfile(tenantId, version.data);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/ai-settings" && method === "GET") {
    return sendJson(res, 200, getAiSettings(tenantId) ?? {});
  }

  if (url.pathname === "/api/ai-settings" && method === "PUT") {
    if (membership.role !== "athlete") return sendJson(res, 403, { error: "Solo el atleta puede configurar el proveedor de IA" });
    const body = await readBody(req);
    if (!body?.provider || !body?.apiKey) return sendJson(res, 400, { error: "Falta provider o apiKey" });
    saveAiSettings(tenantId, {
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model ?? "gemini-2.0-flash",
    });
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/ai-settings/test" && method === "POST") {
    if (membership.role !== "athlete") return sendJson(res, 403, { error: "Solo el atleta puede probar la conexión" });
    const settings = getAiSettingsWithKey(tenantId);
    if (!settings) return sendJson(res, 400, { error: "No hay proveedor de IA configurado" });
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-goog-api-key": settings.api_key },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo con 'OK'" }] }] }),
        }
      );
      if (!response.ok) {
        const err = await response.text();
        return sendJson(res, 400, { error: `Error de la API: ${response.status} - ${err}` });
      }
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: `Error de conexión: ${err.message}` });
    }
  }

  if (url.pathname === "/api/prompts" && method === "GET") {
    return sendJson(res, 200, getPrompts(tenantId));
  }

  if (url.pathname === "/api/prompts" && method === "POST") {
    if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(req);
    if (!body?.name || !body?.content) return sendJson(res, 400, { error: "Falta name o content" });
    try {
      const id = savePrompt(tenantId, { name: body.name, content: body.content });
      return sendJson(res, 201, { id });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const promptMatch = url.pathname.match(/^\/api\/prompts\/([^/]+)$/);
  if (promptMatch && method === "DELETE") {
    if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    const promptId = decodeURIComponent(promptMatch[1]);
    const deleted = deletePrompt(promptId, tenantId);
    if (!deleted) return sendJson(res, 404, { error: "Prompt no encontrado o es predefinido" });
    res.writeHead(204);
    return res.end();
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    const id = decodeURIComponent(sessionMatch[1]);
    if (method === "GET") {
      const session = getSession(id);
      if (!session) return sendJson(res, 404, { error: "Sesión no encontrada" });
      return sendJson(res, 200, session);
    }
    if (method === "PUT") {
      if (!canWrite(membership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
      const body = await readBody(req);
      const updated = updateSession(id, body ?? {});
      if (!updated) return sendJson(res, 404, { error: "Sesión no encontrada" });
      return sendJson(res, 200, updated);
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const membersMatch = url.pathname.match(/^\/api\/tenants\/([^/]+)\/members$/);
  if (membersMatch) {
    const targetTenantId = decodeURIComponent(membersMatch[1]);
    const targetMembership = requireMember(targetTenantId, user);
    if (method === "GET") return sendJson(res, 200, listMembers(targetTenantId));
    if (method === "POST") {
      if (!canManage(targetMembership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
      const body = await readBody(req);
      return sendJson(res, 201, addMember(targetTenantId, body ?? {}));
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const tenantNameMatch = url.pathname.match(/^\/api\/tenants\/([^/]+)\/name$/);
  if (tenantNameMatch) {
    const targetTenantId = decodeURIComponent(tenantNameMatch[1]);
    const targetMembership = requireMember(targetTenantId, user);
    if (!canManage(targetMembership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    if (method === "PUT") {
      const body = await readBody(req);
      return sendJson(res, 200, renameTenant(targetTenantId, body?.name));
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const memberMatch = url.pathname.match(/^\/api\/tenants\/([^/]+)\/members\/([^/]+)$/);
  if (memberMatch) {
    const targetTenantId = decodeURIComponent(memberMatch[1]);
    const targetUserId = decodeURIComponent(memberMatch[2]);
    const targetMembership = requireMember(targetTenantId, user);
    if (!canManage(targetMembership)) return sendJson(res, 403, { error: "No tienes permisos para esta acción" });
    if (method === "PUT") {
      const body = await readBody(req);
      updateMemberRole(targetTenantId, targetUserId, body?.role);
      return sendJson(res, 200, { ok: true });
    }
    if (method === "DELETE") {
      removeMember(targetTenantId, targetUserId);
      res.writeHead(204);
      return res.end();
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  const url = new URL(pathname, "http://localhost");

  if (url.pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/auth/config" && method === "GET") {
    return sendJson(res, 200, { clientId: process.env.GOOGLE_CLIENT_ID ?? null });
  }

  if (url.pathname === "/api/auth/google" && method === "POST") {
    const body = await readBody(req);
    if (!body?.credential) return sendJson(res, 400, { error: "Falta el credential de Google" });
    const googleUser = await verifyGoogleToken(body.credential);
    const user = findOrCreateUser(googleUser);
    const token = createSessionToken(user.id);
    setCookie(res, AUTH_COOKIE, token, 60 * 60 * 24 * 30);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE];
  const user = getUserByToken(token);
  if (!user) return sendJson(res, 401, { error: "No autenticado" });

  if (url.pathname === "/api/auth/logout" && method === "POST") {
    destroySessionToken(token);
    setCookie(res, AUTH_COOKIE, "", 0);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/me" && method === "GET") {
    const tenants = getTenantMemberships(user.id);
    const requestedTenant = cookies[TENANT_COOKIE];
    const activeTenantId =
      tenants.find((t) => t.id === requestedTenant)?.id ?? tenants[0]?.id ?? null;
    return sendJson(res, 200, {
      user: publicUser(user),
      tenants,
      activeTenantId,
    });
  }

  if (url.pathname === "/api/switch-tenant" && method === "POST") {
    const body = await readBody(req);
    const targetId = body?.tenantId;
    if (!targetId) return sendJson(res, 400, { error: "Falta tenantId" });
    requireMember(targetId, user);
    setCookie(res, TENANT_COOKIE, targetId, 60 * 60 * 24 * 365);
    return sendJson(res, 200, { activeTenantId: targetId });
  }

  const tenantId = req.headers["x-tenant-id"] ?? cookies[TENANT_COOKIE];
  if (!tenantId) return sendJson(res, 400, { error: "Falta el tenant (X-Tenant-Id)" });
  const membership = getMembership(tenantId, user.id);
  if (!membership) return sendJson(res, 403, { error: "Sin acceso a este tenant" });

  return withTenant(tenantId, () => handleTenantRoutes(req, res, url, method, user, membership));
}

const server = http.createServer((req, res) => {
  const pathname = req.url ?? "/";
  if (pathname.startsWith("/api")) {
    handleApi(req, res, pathname).catch((err) => sendError(res, err));
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, () => {
  const migrated = migrate();
  if (migrated.migrated) {
    console.log(
      `Migración de datos completada: ${migrated.completed} sesiones, ${migrated.planned} planificadas.`
    );
  }
  console.log(`Backend escuchando en http://localhost:${port}`);
  if (staticDir) console.log(`Sirviendo estáticos desde: ${staticDir}`);
});
