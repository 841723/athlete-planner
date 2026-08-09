import { getDb } from "./db.js";

export const SYNC_PROVIDERS = [
  { id: "garmin", name: "Garmin Connect" },
  { id: "strava", name: "Strava" },
];

export function getSyncProvider(id) {
  return SYNC_PROVIDERS.find((p) => p.id === id) ?? null;
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getSyncSource(tenantId, provider) {
  return getDb()
    .prepare("SELECT * FROM sync_sources WHERE tenant_id = ? AND provider = ?")
    .get(tenantId, provider);
}

export function getSyncTokens(tenantId, provider) {
  const row = getSyncSource(tenantId, provider);
  if (!row?.tokens) return null;
  try {
    return JSON.parse(row.tokens);
  } catch {
    return null;
  }
}

export function getSyncTokensRaw(tenantId, provider) {
  const row = getSyncSource(tenantId, provider);
  return row?.tokens ?? null;
}

export function setSyncSource(tenantId, provider, { status, tokens, config, error } = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getSyncSource(tenantId, provider);
  const next = {
    status: status ?? existing?.status ?? "disconnected",
    tokens: tokens !== undefined ? tokens : (existing?.tokens ?? null),
    config: config !== undefined ? JSON.stringify(config) : (existing?.config ?? null),
    error: error !== undefined ? error : (existing?.error ?? null),
  };
  if (existing) {
    db.prepare(
      `UPDATE sync_sources SET status = ?, tokens = ?, config = ?, error = ?, updated_at = ?
       WHERE tenant_id = ? AND provider = ?`
    ).run(next.status, next.tokens, next.config, next.error, now, tenantId, provider);
  } else {
    db.prepare(
      `INSERT INTO sync_sources (tenant_id, provider, status, tokens, config, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(tenantId, provider, next.status, next.tokens, next.config, next.error, now, now);
  }
  return next;
}

export function updateSyncSourceStatus(tenantId, provider, status, error = null) {
  const db = getDb();
  db.prepare(
    "UPDATE sync_sources SET status = ?, error = ?, updated_at = ? WHERE tenant_id = ? AND provider = ?"
  ).run(status, error, new Date().toISOString(), tenantId, provider);
}

export function disconnectSyncSource(tenantId, provider) {
  setSyncSource(tenantId, provider, { status: "disconnected", tokens: null, error: null });
}

export function saveSyncConfig(tenantId, provider, config) {
  const existing = getSyncSource(tenantId, provider);
  setSyncSource(tenantId, provider, { config: { ...(parseJson(existing?.config) ?? {}), ...config } });
}

export function toSyncSourceDto(row, provider) {
  const config = parseJson(row?.config) ?? {};
  const status = row?.status ?? "disconnected";
  return {
    provider: provider.id,
    name: provider.name,
    status,
    connected: status === "connected",
    config: {
      min_date: config.min_date ?? null,
      max_date: config.max_date ?? null,
      account_name: config.account_name ?? null,
    },
    error: row?.error ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export function listSyncSources(tenantId) {
  return SYNC_PROVIDERS.map((p) => {
    const row = getSyncSource(tenantId, p.id);
    return toSyncSourceDto(row, p);
  });
}
