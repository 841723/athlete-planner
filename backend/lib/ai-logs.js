import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export const MAX_LOG_CHARS = 100_000;

export function maskApiKey(key) {
  if (!key || typeof key !== "string") return null;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function truncate(text) {
  if (text == null) return null;
  const s = String(text);
  return s.length > MAX_LOG_CHARS ? s.slice(0, MAX_LOG_CHARS) : s;
}

export function logAiRequest({
  tenantId,
  userId = null,
  apiKeyId = null,
  authMethod,
  actor = null,
  provider,
  model,
  endpoint,
  apiKey,
  input,
  response,
  status = null,
  ok = true,
  durationMs = null,
}) {
  if (!tenantId) return;
  getDb()
    .prepare(
      `INSERT INTO ai_logs (id, tenant_id, user_id, api_key_id, auth_method, actor, provider, model, endpoint, api_key_masked, input, response, status, ok, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      tenantId,
      userId,
      apiKeyId,
      authMethod,
      actor,
      provider,
      model,
      endpoint,
      maskApiKey(apiKey),
      truncate(input),
      truncate(response),
      status,
      ok ? 1 : 0,
      durationMs,
      new Date().toISOString()
    );
}

export function listAiLogs(tenantId, limit = 50) {
  return getDb()
    .prepare(
      `SELECT id, user_id, api_key_id, auth_method, actor, provider, model, endpoint, api_key_masked, input, response, status, ok, duration_ms, created_at
       FROM ai_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(tenantId, limit);
}
