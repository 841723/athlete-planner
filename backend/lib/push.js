import crypto from "node:crypto";
import webpush from "web-push";
import { getDb } from "./db.js";

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
const configured = Boolean(publicKey && privateKey);

if (configured) webpush.setVapidDetails(subject, publicKey, privateKey);

export function getPushConfig() {
  return { enabled: configured, publicKey: configured ? publicKey : null };
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
    if (!configured) return { sent: 0, disabled: true };
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
