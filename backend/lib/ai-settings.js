import { getDb } from "./db.js";

export function getAiSettings(tenantId) {
  const row = getDb()
    .prepare("SELECT provider, model FROM ai_provider_settings WHERE tenant_id = ?")
    .get(tenantId);
  return row ?? null;
}

export function getAiSettingsWithKey(tenantId) {
  const row = getDb()
    .prepare("SELECT provider, api_key, model FROM ai_provider_settings WHERE tenant_id = ?")
    .get(tenantId);
  return row ?? null;
}

export function saveAiSettings(tenantId, { provider, apiKey, model }) {
  getDb()
    .prepare(
      `INSERT INTO ai_provider_settings (tenant_id, provider, api_key, model, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET provider = excluded.provider, api_key = excluded.api_key, model = excluded.model, updated_at = excluded.updated_at`
    )
    .run(tenantId, provider, apiKey, model, new Date().toISOString());
}
