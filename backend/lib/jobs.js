import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

const LEASE_MS = 15 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function dto(row) {
  if (!row) return null;
  return {
    ...row,
    payload: parseJson(row.payload, {}),
    result: parseJson(row.result),
    progress: parseJson(row.progress),
  };
}

export function createJob({
  tenantId,
  userId = null,
  type,
  dedupeKey = type,
  payload = {},
  relatedResourceType = null,
  relatedResourceId = null,
  deepLink = null,
}) {
  const id = randomUUID();
  const createdAt = now();
  try {
    getDb().prepare(`
      INSERT INTO jobs
        (id, tenant_id, user_id, type, status, dedupe_key, payload,
         related_resource_type, related_resource_id, deep_link, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      userId,
      type,
      dedupeKey,
      JSON.stringify(payload ?? {}),
      relatedResourceType,
      relatedResourceId,
      deepLink,
      createdAt,
    );
  } catch (error) {
    if (String(error?.message).includes("UNIQUE constraint failed: jobs.tenant_id, jobs.dedupe_key")) {
      const active = getDb().prepare(
        "SELECT * FROM jobs WHERE tenant_id = ? AND dedupe_key = ? AND status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1"
      ).get(tenantId, dedupeKey);
      const conflict = new Error("Ya existe una operación equivalente en curso");
      conflict.status = 409;
      conflict.job = dto(active);
      throw conflict;
    }
    throw error;
  }
  return getJob(tenantId, id);
}

export function getJob(tenantId, id) {
  return dto(getDb().prepare("SELECT * FROM jobs WHERE tenant_id = ? AND id = ?").get(tenantId, id));
}

export function listJobs(tenantId, { activeOnly = false, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const where = activeOnly ? "AND status IN ('pending', 'running')" : "";
  return getDb().prepare(
    `SELECT * FROM jobs WHERE tenant_id = ? ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(tenantId, safeLimit).map(dto);
}

export function cancelJob(tenantId, id) {
  const result = getDb().prepare(
    "UPDATE jobs SET status = 'cancelled', finished_at = ? WHERE tenant_id = ? AND id = ? AND status IN ('pending', 'running')"
  ).run(now(), tenantId, id);
  return result.changes > 0;
}

export function claimNextJob() {
  const db = getDb();
  const cutoff = new Date(Date.now() - LEASE_MS).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "UPDATE jobs SET status = 'failed', error = 'El worker dejó de responder', finished_at = ? WHERE status = 'running' AND heartbeat_at < ?"
    ).run(now(), cutoff);
    const row = db.prepare(
      "SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1"
    ).get();
    if (!row) {
      db.exec("COMMIT");
      return null;
    }
    const startedAt = now();
    const changed = db.prepare(
      "UPDATE jobs SET status = 'running', attempts = attempts + 1, started_at = ?, heartbeat_at = ? WHERE id = ? AND status = 'pending'"
    ).run(startedAt, startedAt, row.id).changes;
    db.exec("COMMIT");
    return changed ? dto({ ...row, status: "running", started_at: startedAt, heartbeat_at: startedAt, attempts: row.attempts + 1 }) : null;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore rollback failure */ }
    throw error;
  }
}

export function heartbeatJob(id) {
  getDb().prepare("UPDATE jobs SET heartbeat_at = ? WHERE id = ? AND status = 'running'").run(now(), id);
}

export function finishJob(id, status, { result = null, error = null, progress = null } = {}) {
  getDb().prepare(
    "UPDATE jobs SET status = ?, result = ?, error = ?, progress = ?, finished_at = ?, heartbeat_at = ? WHERE id = ? AND status = 'running'"
  ).run(status, result == null ? null : JSON.stringify(result), error, progress == null ? null : JSON.stringify(progress), now(), now(), id);
}

export function updateJobProgress(id, progress) {
  getDb().prepare("UPDATE jobs SET progress = ?, heartbeat_at = ? WHERE id = ? AND status = 'running'")
    .run(JSON.stringify(progress ?? {}), now(), id);
}
