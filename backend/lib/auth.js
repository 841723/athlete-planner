import { randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { getDb } from "./db.js";

export const AUTH_COOKIE = "endurance_tok";
export const TENANT_COOKIE = "endurance_tid";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? null;
}

export async function verifyGoogleToken(credential) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    const err = new Error("GOOGLE_CLIENT_ID no configurado");
    err.status = 500;
    throw err;
  }
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export function findOrCreateUser({ sub, email, name, picture }) {
  const db = getDb();
  let user = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub);
  if (!user) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user) {
      db.prepare("UPDATE users SET google_sub = ?, name = ?, picture = ?, email = ? WHERE id = ?").run(
        sub,
        name ?? user.name,
        picture ?? user.picture,
        email,
        user.id
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }
  }
  if (!user) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, sub, email, name ?? null, picture ?? null, new Date().toISOString());
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }
  return user;
}

export function createSessionToken(userId) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    )
    .run(
      token,
      userId,
      new Date(now).toISOString(),
      new Date(now + SESSION_TTL_MS).toISOString()
    );
  return token;
}

export function getUserByToken(token) {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.user_id AS user_id, u.email, u.name, u.picture, u.google_sub
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  const session = db.prepare("SELECT expires_at FROM auth_sessions WHERE token = ?").get(token);
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    return null;
  }
  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    google_sub: row.google_sub,
  };
}

export function destroySessionToken(token) {
  if (token) getDb().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

export function getTenantMemberships(userId) {
  return getDb()
    .prepare(
      `SELECT t.id, t.name, t.slug, m.role, m.is_owner
       FROM tenant_members m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = ?
       ORDER BY m.is_owner DESC, t.name`
    )
    .all(userId)
    .map(({ is_owner, ...r }) => ({ ...r, isOwner: Boolean(is_owner) }));
}

export function getMembership(tenantId, userId) {
  const row = getDb()
    .prepare("SELECT * FROM tenant_members WHERE tenant_id = ? AND user_id = ?")
    .get(tenantId, userId);
  if (!row) return null;
  const { is_owner, ...rest } = row;
  return { ...rest, isOwner: Boolean(is_owner) };
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
}
