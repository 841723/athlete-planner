import {
  AUTH_COOKIE,
  TENANT_COOKIE,
  verifyGoogleToken,
  findOrCreateUser,
  createSessionToken,
  getUserByToken,
  destroySessionToken,
  getTenantMemberships,
  publicUser,
} from "../lib/auth.js";
import { sendJson, readBody, setCookie, parseCookies, requireMember } from "../lib/http.js";

export function registerPublic(router) {
  router.get("/api/health", (c) => {
    return sendJson(c.res, 200, { ok: true });
  });

  router.get("/api/auth/config", (c) => {
    return sendJson(c.res, 200, { clientId: process.env.GOOGLE_CLIENT_ID ?? null });
  });

  router.post("/api/auth/google", async (c) => {
    const body = await readBody(c.req);
    if (!body?.credential) return sendJson(c.res, 400, { error: "Falta el credential de Google" });
    const googleUser = await verifyGoogleToken(body.credential);
    const user = findOrCreateUser(googleUser);
    const token = createSessionToken(user.id);
    setCookie(c.res, AUTH_COOKIE, token, 60 * 60 * 24 * 30);
    return sendJson(c.res, 200, { user: publicUser(user) });
  });
}

export function registerUser(router) {
  router.post("/api/auth/logout", (c) => {
    destroySessionToken(c.token);
    setCookie(c.res, AUTH_COOKIE, "", 0);
    return sendJson(c.res, 200, { ok: true });
  });

  router.get("/api/me", (c) => {
    const tenants = getTenantMemberships(c.user.id);
    const requestedTenant = parseCookies(c.req)[TENANT_COOKIE];
    const activeTenantId = tenants.find((t) => t.id === requestedTenant)?.id ?? tenants[0]?.id ?? null;
    return sendJson(c.res, 200, {
      user: publicUser(c.user),
      tenants,
      activeTenantId,
    });
  });

  router.post("/api/switch-tenant", async (c) => {
    const body = await readBody(c.req);
    const targetId = body?.tenantId;
    if (!targetId) return sendJson(c.res, 400, { error: "Falta tenantId" });
    requireMember(targetId, c.user);
    setCookie(c.res, TENANT_COOKIE, targetId, 60 * 60 * 24 * 365);
    return sendJson(c.res, 200, { activeTenantId: targetId });
  });
}
