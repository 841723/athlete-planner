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
  inputTokens = null,
  outputTokens = null,
  cost = null,
  currency = null,
}) {
  if (!tenantId) return;
  getDb()
    .prepare(
      `INSERT INTO ai_logs (id, tenant_id, user_id, api_key_id, auth_method, actor, provider, model, endpoint, api_key_masked, input, response, status, ok, duration_ms, input_tokens, output_tokens, cost, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      inputTokens,
      outputTokens,
      cost,
      currency,
      new Date().toISOString()
    );
}

const LOG_SELECT = `SELECT id, user_id, api_key_id, auth_method, actor, provider, model, endpoint, api_key_masked, input, response, status, ok, duration_ms, input_tokens, output_tokens, cost, currency, created_at`;

export function listAiLogs(tenantId, { limit = 50, offset = 0, ok = null, provider = null } = {}) {
  const clauses = ["tenant_id = ?"];
  const params = [tenantId];
  if (ok === "ok") {
    clauses.push("ok = 1");
  } else if (ok === "error") {
    clauses.push("ok = 0");
  }
  if (provider) {
    clauses.push("provider = ?");
    params.push(provider);
  }
  const where = clauses.join(" AND ");

  const total = getDb().prepare(`SELECT COUNT(*) AS n FROM ai_logs WHERE ${where}`).get(...params).n;

  const rows = getDb()
    .prepare(
      `${LOG_SELECT} FROM ai_logs WHERE ${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const sum = getDb().prepare(`SELECT COUNT(*) AS n, SUM(cost) AS cost FROM ai_logs WHERE ${where}`).get(...params);

  return {
    items: rows,
    total,
    costTotal: sum?.cost ?? 0,
    currency: null,
  };
}

export function listAiLogsProviders(tenantId) {
  return getDb()
    .prepare("SELECT DISTINCT provider FROM ai_logs WHERE tenant_id = ? AND provider IS NOT NULL ORDER BY provider")
    .all(tenantId)
    .map((r) => r.provider);
}
