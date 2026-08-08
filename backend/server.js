import http from "node:http";
import path from "node:path";

try {
  process.loadEnvFile();
} catch {
  // No .env (p.ej. variables ya exportadas); continuar.
}
import { AUTH_COOKIE, TENANT_COOKIE, getUserByToken, getMembership } from "./lib/auth.js";
import { getApiKeyContext } from "./lib/api-keys.js";
import { withTenant } from "./lib/sessions.js";
import { migrate } from "./lib/migrate.js";
import { serveStatic, parseCookies, sendJson, sendError } from "./lib/http.js";
import { buildPublicRouter, buildUserRouter, buildTenantRouter } from "./routes/index.js";

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

const publicRouter = buildPublicRouter();
const userRouter = buildUserRouter();
const tenantRouter = buildTenantRouter();

function apiKeyActor(apiKeyCtx) {
  return {
    tenantId: apiKeyCtx.tenantId,
    apiKeyId: apiKeyCtx.apiKeyId,
    authMethod: "api_key",
    display: `api_key:${apiKeyCtx.role}`,
  };
}

function userActor(tenantId, user) {
  return {
    tenantId,
    userId: user.id,
    authMethod: "google",
    display: user.email,
  };
}

function apiKeyFromHeader(req) {
  const header = req.headers.authorization ?? req.headers["x-api-key"];
  if (!header) return null;
  const value = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return getApiKeyContext(value);
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  const url = new URL(pathname, "http://localhost");
  const cookies = parseCookies(req);

  const publicResult = publicRouter.handle(req, res, url, {});
  if (publicResult?.matched) return publicResult.result;

  const apiKeyCtx = apiKeyFromHeader(req);
  let user = null;
  let token = null;

  if (apiKeyCtx) {
    return withTenant(apiKeyCtx.tenantId, () => {
      const ctx = {
        user: null,
        token: null,
        tenantId: apiKeyCtx.tenantId,
        apiKeyId: apiKeyCtx.apiKeyId,
        authMethod: "api_key",
        membership: { role: apiKeyCtx.role, isOwner: false },
        actor: apiKeyActor(apiKeyCtx),
      };
      const result = tenantRouter.handle(req, res, url, ctx);
      if (result?.matched) return result.result;
      return sendJson(res, 404, { error: "Ruta no encontrada" });
    });
  }

  token = cookies[AUTH_COOKIE];
  user = getUserByToken(token);
  if (!user) return sendJson(res, 401, { error: "No autenticado" });

  const userResult = userRouter.handle(req, res, url, { user, token });
  if (userResult?.matched) return userResult.result;

  const tenantId = req.headers["x-tenant-id"] ?? cookies[TENANT_COOKIE];
  if (!tenantId) return sendJson(res, 400, { error: "Falta el tenant (X-Tenant-Id)" });
  const membership = getMembership(tenantId, user.id);
  if (!membership) return sendJson(res, 403, { error: "Sin acceso a este tenant" });

  return withTenant(tenantId, () => {
    const ctx = {
      user,
      token,
      tenantId,
      apiKeyId: null,
      authMethod: "google",
      membership,
      actor: userActor(tenantId, user),
    };
    const result = tenantRouter.handle(req, res, url, ctx);
    if (result?.matched) return result.result;
    return sendJson(res, 404, { error: "Ruta no encontrada" });
  });
}

const server = http.createServer((req, res) => {
  const pathname = req.url ?? "/";
  if (pathname.startsWith("/api")) {
    handleApi(req, res, pathname).catch((err) => sendError(res, err));
  } else {
    serveStatic(req, res, staticDir);
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
