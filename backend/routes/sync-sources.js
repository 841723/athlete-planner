import { randomBytes } from "node:crypto";
import {
  listSyncSources,
  getSyncSource,
  getSyncProvider,
  setSyncSource,
  disconnectSyncSource,
  saveSyncConfig,
  toSyncSourceDto,
} from "../lib/sync-sources.js";
import { garminLogin } from "../lib/garmin.js";
import { stravaConfigured, stravaAuthorizeUrl, stravaExchangeCode } from "../lib/strava.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

function redirectUri(c) {
  if (process.env.STRAVA_REDIRECT_URI) return process.env.STRAVA_REDIRECT_URI;
  const host = c.req.headers.host ?? "localhost:3000";
  const proto = c.req.headers["x-forwarded-proto"] ?? "http";
  return `${proto}://${host}/api/sync-sources/strava/callback`;
}

function syncSourceDto(c, providerId) {
  return toSyncSourceDto(getSyncSource(c.tenantId, providerId), getSyncProvider(providerId));
}

export function registerPublic(router) {
  router.get("/api/sync-sources/strava/callback", async (c) => {
    const url = new URL(c.url ?? "/", "http://localhost");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (!state) {
      c.res.writeHead(302, { Location: "/" });
      return c.res.end();
    }
    const tenantId = state.split(".")[0];
    const nonce = state.split(".")[1] ?? null;
    const tenantPath = `/${tenantId}/config/sync`;

    if (error) {
      c.res.writeHead(302, { Location: `${tenantPath}?error=strava` });
      return c.res.end();
    }
    if (!code) {
      c.res.writeHead(302, { Location: `${tenantPath}?error=strava` });
      return c.res.end();
    }

    const source = getSyncSource(tenantId, "strava");
    if (!source || source.config !== JSON.stringify({ state_nonce: nonce }) && !(source.config ?? "").includes(nonce)) {
      c.res.writeHead(302, { Location: `${tenantPath}?error=strava_invalid` });
      return c.res.end();
    }

    try {
      const tokens = await stravaExchangeCode(code);
      setSyncSource(tenantId, "strava", {
        status: "connected",
        tokens: JSON.stringify(tokens),
        config: { account_name: tokens.athlete_name },
        error: null,
      });
      c.res.writeHead(302, { Location: `${tenantPath}?connected=strava` });
      return c.res.end();
    } catch (err) {
      setSyncSource(tenantId, "strava", { status: "error", error: err.message });
      c.res.writeHead(302, { Location: `${tenantPath}?error=strava` });
      return c.res.end();
    }
  });
}

export function register(router) {
  router.get("/api/sync-sources", (c) => {
    return sendJson(c.res, 200, { items: listSyncSources(c.tenantId), stravaConfigured: stravaConfigured() });
  });

  router.post("/api/sync-sources/garmin/connect", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body?.email?.trim() || !body?.password) {
      return sendJson(c.res, 400, { error: "Faltan email y contraseña de Garmin" });
    }
    setSyncSource(c.tenantId, "garmin", { status: "connecting", error: null });
    try {
      const result = await garminLogin({ email: body.email.trim(), password: body.password });
      if (result.mfaRequired) {
        return sendJson(c.res, 202, { status: "connecting", mfaRequired: true });
      }
      setSyncSource(c.tenantId, "garmin", {
        status: "connected",
        tokens: result.tokens,
        config: { account_name: body.email.trim() },
        error: null,
      });
      return sendJson(c.res, 200, { ok: true, item: syncSourceDto(c, "garmin") });
    } catch (err) {
      setSyncSource(c.tenantId, "garmin", { status: "error", error: err.message });
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.post("/api/sync-sources/garmin/mfa", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body?.email?.trim() || !body?.password || !body?.code?.trim()) {
      return sendJson(c.res, 400, { error: "Faltan email, contraseña o código MFA" });
    }
    try {
      const result = await garminLogin({
        email: body.email.trim(),
        password: body.password,
        mfaCode: body.code.trim(),
      });
      if (result.mfaRequired) {
        return sendJson(c.res, 202, { status: "connecting", mfaRequired: true });
      }
      setSyncSource(c.tenantId, "garmin", {
        status: "connected",
        tokens: result.tokens,
        config: { account_name: body.email.trim() },
        error: null,
      });
      return sendJson(c.res, 200, { ok: true, item: syncSourceDto(c, "garmin") });
    } catch (err) {
      setSyncSource(c.tenantId, "garmin", { status: "error", error: err.message });
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.post("/api/sync-sources/strava/connect", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (!stravaConfigured()) {
      return sendJson(c.res, 400, { error: "Strava no está configurado en el servidor (STRAVA_CLIENT_ID/SECRET)" });
    }
    const nonce = randomBytes(12).toString("hex");
    const state = `${c.tenantId}.${nonce}`;
    saveSyncConfig(c.tenantId, "strava", { state_nonce: nonce });
    const uri = redirectUri(c);
    return sendJson(c.res, 200, { url: stravaAuthorizeUrl(uri, state), redirectUri: uri });
  });

  router.post("/api/sync-sources/:provider/disconnect", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (!getSyncProvider(c.params.provider)) return sendJson(c.res, 400, { error: "Proveedor desconocido" });
    disconnectSyncSource(c.tenantId, c.params.provider);
    return sendJson(c.res, 200, { ok: true, item: syncSourceDto(c, c.params.provider) });
  });

  router.put("/api/sync-sources/:provider/config", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (!getSyncProvider(c.params.provider)) return sendJson(c.res, 400, { error: "Proveedor desconocido" });
    const body = await readBody(c.req);
    saveSyncConfig(c.tenantId, c.params.provider, { min_date: body?.min_date ?? null });
    return sendJson(c.res, 200, { ok: true, item: syncSourceDto(c, c.params.provider) });
  });
}
