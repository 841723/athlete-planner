import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const MAX_VERSIONS = 15;

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function getProfileHistory(tenantId) {
  return getDb()
    .prepare(
      "SELECT id, author, created_at FROM athlete_profile_history WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(tenantId, MAX_VERSIONS);
}

export function getProfileVersion(versionId) {
  const row = getDb()
    .prepare("SELECT id, tenant_id, data, author, created_at FROM athlete_profile_history WHERE id = ?")
    .get(versionId);
  if (!row) return null;
  try {
    return { ...row, data: JSON.parse(row.data) };
  } catch {
    return null;
  }
}

export function saveProfileVersion(tenantId, profile, author = "user") {
  const lastVersion = getDb()
    .prepare(
      "SELECT data FROM athlete_profile_history WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(tenantId);

  if (lastVersion) {
    try {
      const lastData = JSON.parse(lastVersion.data);
      if (deepEqual(lastData, profile)) return null;
    } catch {}
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO athlete_profile_history (id, tenant_id, data, author, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, tenantId, JSON.stringify(profile), author, now);

  const count = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM athlete_profile_history WHERE tenant_id = ?")
    .get(tenantId).cnt;

  if (count > MAX_VERSIONS) {
    getDb()
      .prepare(
        `DELETE FROM athlete_profile_history WHERE tenant_id = ? AND id IN (
          SELECT id FROM athlete_profile_history WHERE tenant_id = ? ORDER BY created_at ASC LIMIT ?
        )`
      )
      .run(tenantId, tenantId, count - MAX_VERSIONS);
  }

  return id;
}
