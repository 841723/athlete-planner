import { randomBytes, randomUUID, createHash } from "node:crypto";
import { getDb } from "./db.js";

const PREFIX = "tplr_";
const KEY_ROLES = new Set(["admin", "visitor"]);

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(tenantId, { name, role = "admin", createdBy = null }) {
  if (!name || typeof name !== "string" || !name.trim()) {
    const err = new Error("Falta el nombre de la API key");
    err.status = 400;
    throw err;
  }
  if (!KEY_ROLES.has(role)) {
    const err = new Error("Rol inválido (solo admin o visitor)");
    err.status = 400;
    throw err;
  }
  const raw = `${PREFIX}${randomBytes(24).toString("hex")}`;
  getDb()
    .prepare(
      "INSERT INTO api_keys (id, tenant_id, name, key_hash, prefix, role, active, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .run(
      randomUUID(),
      tenantId,
      name.trim(),
      hashKey(raw),
      `${PREFIX}${raw.slice(PREFIX.length, PREFIX.length + 4)}`,
      role,
      new Date().toISOString(),
      createdBy
    );
  return raw;
}

export function listApiKeys(tenantId) {
  return getDb()
    .prepare(
      "SELECT id, name, prefix, role, active, created_at, last_used_at, created_by FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC"
    )
    .all(tenantId)
    .map(({ active, ...r }) => ({ ...r, active: Boolean(active) }));
}

export function revokeApiKey(tenantId, id) {
  const row = getDb()
    .prepare("SELECT id FROM api_keys WHERE tenant_id = ? AND id = ?")
    .get(tenantId, id);
  if (!row) return false;
  getDb().prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  return true;
}

export function getApiKeyContext(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return null;
  const row = getDb()
    .prepare("SELECT id, tenant_id, role, active FROM api_keys WHERE key_hash = ?")
    .get(hashKey(rawKey));
  if (!row || !row.active) return null;
  getDb()
    .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);
  return { apiKeyId: row.id, tenantId: row.tenant_id, role: row.role };
}
