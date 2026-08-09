import {
  getDefaultAiConfig,
  saveAiConfig,
  chatDurationLabel,
  getChatWindowMs as getChatWindowMsForConfig,
} from "./ai-configs.js";

export { chatDurationLabel };

export function getAiSettings(tenantId) {
  const cfg = getDefaultAiConfig(tenantId);
  if (!cfg) return null;
  const { id: _id, is_default: _d, ...rest } = cfg;
  return rest;
}

export function getAiSettingsWithKey(tenantId) {
  const cfg = getDefaultAiConfig(tenantId, true);
  if (!cfg) return null;
  const { id: _id, is_default: _d, ...rest } = cfg;
  return { ...rest, api_key: cfg.api_key ?? "" };
}

export function saveAiSettings(tenantId, { provider, apiKey, model, baseUrl, currency, chatDurationHours, pricing }) {
  const cfg = getDefaultAiConfig(tenantId);
  return saveAiConfig(tenantId, {
    id: cfg?.id ?? null,
    name: cfg?.name ?? "Configuración principal",
    provider,
    apiKey: apiKey ?? "",
    model,
    baseUrl,
    currency,
    chatDurationHours,
    pricing,
    isDefault: true,
  });
}

export function getChatWindowMs(tenantId) {
  return getChatWindowMsForConfig(getDefaultAiConfig(tenantId));
}
