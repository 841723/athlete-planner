import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export const MAX_AI_CONFIGS = 5;

const HOUR_MS = 60 * 60 * 1000;

function parsePricing(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function chatDurationLabel(chatDurationHours) {
  if (chatDurationHours == null || Number(chatDurationHours) <= 0) return "Sin límite";
  const hours = Number(chatDurationHours);
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "24 h" : `${days} días`;
  }
  return `${hours} h`;
}

export function getChatWindowMs(config) {
  const hours = config?.chat_duration_hours;
  if (hours == null || Number(hours) <= 0) return null;
  return Number(hours) * HOUR_MS;
}

function toDto(row, withKey = false) {
  if (!row) return null;
  const dto = {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    base_url: row.base_url,
    currency: row.currency,
    chat_duration_hours: row.chat_duration_hours,
    chatDurationLabel: chatDurationLabel(row.chat_duration_hours),
    pricing: parsePricing(row.pricing),
    is_default: !!row.is_default,
  };
  if (withKey) dto.api_key = row.api_key;
  return dto;
}

function seedFromLegacy(tenantId) {
  const legacy = getDb()
    .prepare(
      "SELECT provider, api_key, model, base_url, currency, chat_duration_hours, pricing FROM ai_provider_settings WHERE tenant_id = ?"
    )
    .get(tenantId);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO ai_configs (id, tenant_id, name, provider, api_key, model, base_url, currency, chat_duration_hours, pricing, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      randomUUID(),
      tenantId,
      "Configuración principal",
      legacy?.provider ?? "gemini",
      legacy?.api_key ?? "",
      legacy?.model ?? null,
      legacy?.base_url ?? null,
      legacy?.currency ?? "EUR",
      legacy?.chat_duration_hours ?? 24,
      legacy?.pricing ?? null,
      now,
      now
    );
}

export function seedDefaultAiConfig(tenantId) {
  const count = getDb().prepare("SELECT COUNT(*) AS cnt FROM ai_configs WHERE tenant_id = ?").get(tenantId).cnt;
  if (count > 0) return;
  seedFromLegacy(tenantId);
}

// Los tenants nuevos arrancan SIN configuración de IA: no se siembra ningún
// proveedor por defecto. La configuración se crea explícitamente desde
// Configuración → IA. seedDefaultAiConfig queda disponible como migración
// puntual para tenants con settings legadas.
export function listAiConfigs(tenantId) {
  return getDb()
    .prepare(
      "SELECT id, name, provider, model, base_url, currency, chat_duration_hours, pricing, is_default FROM ai_configs WHERE tenant_id = ? ORDER BY is_default DESC, created_at ASC"
    )
    .all(tenantId)
    .map((r) => toDto(r));
}

export function getAiConfig(tenantId, configId) {
  const row = getDb().prepare("SELECT * FROM ai_configs WHERE tenant_id = ? AND id = ?").get(tenantId, configId);
  return row ? toDto(row) : null;
}

export function getAiConfigWithKey(tenantId, configId) {
  const row = getDb().prepare("SELECT * FROM ai_configs WHERE tenant_id = ? AND id = ?").get(tenantId, configId);
  return row ? toDto(row, true) : null;
}

export function getDefaultAiConfig(tenantId, withKey = false) {
  let row = getDb().prepare("SELECT * FROM ai_configs WHERE tenant_id = ? AND is_default = 1").get(tenantId);
  if (!row) {
    row = getDb().prepare("SELECT * FROM ai_configs WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1").get(tenantId);
  }
  return row ? toDto(row, withKey) : null;
}

export function saveAiConfig(
  tenantId,
  { id = null, name, provider, apiKey, model, baseUrl, currency, chatDurationHours, pricing, isDefault = false }
) {
  const count = getDb().prepare("SELECT COUNT(*) AS cnt FROM ai_configs WHERE tenant_id = ?").get(tenantId).cnt;
  if (count >= MAX_AI_CONFIGS && !id) {
    throw new Error(`Máximo ${MAX_AI_CONFIGS} configuraciones de IA permitidas`);
  }

  const cfgId = id ?? randomUUID();
  let apiKeyValue = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "";
  if (!apiKeyValue) {
    const prev = getDb().prepare("SELECT api_key FROM ai_configs WHERE id = ? AND tenant_id = ?").get(cfgId, tenantId);
    if (prev) apiKeyValue = prev.api_key;
  }

  const chatValue = chatDurationHours == null || Number(chatDurationHours) < 0 ? 24 : Math.round(Number(chatDurationHours) || 0);
  const currencyValue = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "EUR";
  const pricingValue = pricing && typeof pricing === "object" ? JSON.stringify(pricing) : null;
  const now = new Date().toISOString();

  if (id) {
    const exists = getDb().prepare("SELECT id FROM ai_configs WHERE tenant_id = ? AND id = ?").get(tenantId, id);
    if (!exists) throw new Error("Configuración de IA no encontrada");
    getDb()
      .prepare(
        `UPDATE ai_configs SET name = ?, provider = ?, api_key = ?, model = ?, base_url = ?, currency = ?, chat_duration_hours = ?, pricing = ?, is_default = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .run(name, provider, apiKeyValue, model ?? null, baseUrl ?? null, currencyValue, chatValue, pricingValue, isDefault ? 1 : 0, now, cfgId, tenantId);
  } else {
    getDb()
      .prepare(
        `INSERT INTO ai_configs (id, tenant_id, name, provider, api_key, model, base_url, currency, chat_duration_hours, pricing, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(cfgId, tenantId, name, provider, apiKeyValue, model ?? null, baseUrl ?? null, currencyValue, chatValue, pricingValue, isDefault ? 1 : 0, now, now);
  }

  if (isDefault) {
    getDb().prepare("UPDATE ai_configs SET is_default = 0 WHERE tenant_id = ? AND id != ?").run(tenantId, cfgId);
  }

  return cfgId;
}

export function setDefaultAiConfig(tenantId, configId) {
  const row = getDb().prepare("SELECT id FROM ai_configs WHERE tenant_id = ? AND id = ?").get(tenantId, configId);
  if (!row) throw new Error("Configuración de IA no encontrada");
  getDb().prepare("UPDATE ai_configs SET is_default = 0 WHERE tenant_id = ?").run(tenantId);
  getDb().prepare("UPDATE ai_configs SET is_default = 1 WHERE tenant_id = ? AND id = ?").run(tenantId, configId);
}

export function deleteAiConfig(tenantId, configId) {
  const row = getDb().prepare("SELECT id, is_default FROM ai_configs WHERE tenant_id = ? AND id = ?").get(tenantId, configId);
  if (!row) return false;
  const count = getDb().prepare("SELECT COUNT(*) AS cnt FROM ai_configs WHERE tenant_id = ?").get(tenantId).cnt;
  if (count <= 1) throw new Error("No se puede eliminar la única configuración de IA");
  getDb().prepare("DELETE FROM ai_configs WHERE id = ? AND tenant_id = ?").run(configId, tenantId);
  if (row.is_default) {
    const first = getDb().prepare("SELECT id FROM ai_configs WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1").get(tenantId);
    if (first) setDefaultAiConfig(tenantId, first.id);
  }
  return true;
}
