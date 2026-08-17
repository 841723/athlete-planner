import crypto from "node:crypto";
import webpush from "web-push";
import { getDb } from "./db.js";

let cachedConfig = null;
let warnedConfig = null;

function getVapidConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = String(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com").trim();
  const signature = `${publicKey}|${privateKey}|${subject}`;

  if (cachedConfig?.signature === signature) return cachedConfig;

  let config;
  if (!publicKey || !privateKey) {
    config = { signature, enabled: false, publicKey: null, reason: "missing_keys" };
  } else {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      config = { signature, enabled: true, publicKey, reason: "ok" };
    } catch (error) {
      config = { signature, enabled: false, publicKey: null, reason: "invalid_keypair" };
      if (warnedConfig !== signature) {
        warnedConfig = signature;
        console.warn("Configuración VAPID inválida; las notificaciones push están desactivadas", error?.message ?? error);
      }
    }
  }

  cachedConfig = config;
  return config;
}

export function getPushConfig() {
  const { enabled, publicKey, reason } = getVapidConfig();
  return { enabled, publicKey, reason };
}

function subscriptionId(tenantId, endpoint) {
  return crypto.createHash("sha256").update(`${tenantId}:${endpoint}`).digest("hex");
}

export function saveSubscription(tenantId, userId, subscription) {
  if (!subscription || typeof subscription !== "object") throw new Error("Suscripción inválida");
  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = typeof subscription.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
  const auth = typeof subscription.keys?.auth === "string" ? subscription.keys.auth : "";
  if (!endpoint || endpoint.length > 2048 || !p256dh || !auth) throw new Error("Faltan datos de la suscripción");
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO push_subscriptions
      (id, tenant_id, user_id, endpoint, p256dh, auth, expiration_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, endpoint) DO UPDATE SET
      tenant_id = excluded.tenant_id, user_id = excluded.user_id,
      p256dh = excluded.p256dh, auth = excluded.auth,
      expiration_time = excluded.expiration_time, updated_at = excluded.updated_at
  `).run(
    subscriptionId(tenantId, endpoint), tenantId, userId ?? null, endpoint, p256dh, auth,
    Number.isFinite(subscription.expirationTime) ? subscription.expirationTime : null, now, now
  );
  return { ok: true };
}

export function deleteSubscription(tenantId, endpoint) {
  return getDb().prepare("DELETE FROM push_subscriptions WHERE tenant_id = ? AND endpoint = ?")
    .run(tenantId, endpoint).changes > 0;
}

export function listSubscriptions(tenantId) {
  return getDb().prepare(
    "SELECT id, endpoint, expiration_time, created_at, updated_at FROM push_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC",
  ).all(tenantId);
}

// Delivery is best effort: a dead browser must never fail its caller.
export async function sendPushToTenant(tenantId, payload) {
  return sendPushWhere("tenant_id = ?", [tenantId], payload);
}

export async function sendPushToUser(tenantId, userId, payload) {
  if (!userId) return sendPushToTenant(tenantId, payload);
  return sendPushWhere("tenant_id = ? AND user_id = ?", [tenantId, userId], payload);
}

async function sendPushWhere(condition, params, payload) {
  try {
    if (!getVapidConfig().enabled) return { sent: 0, disabled: true };
    const db = getDb();
    const rows = db.prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE ${condition}`)
      .all(...params);
    let sent = 0;
    await Promise.all(rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(row.id);
        }
      }
    }));
    return { sent, removed: rows.length - sent };
  } catch {
    return { sent: 0, error: "push delivery failed" };
  }
}
