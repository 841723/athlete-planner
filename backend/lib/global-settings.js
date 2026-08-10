// Configuración global del sistema (por clave, sin tenant).
// Claves:
//   enabled_providers: JSON array de ids de proveedores de IA habilitados.
//   opencode_base_url:  URL de la instancia local de opencode (por defecto env
//                       OPENCODE_BASE_URL → http://localhost:4096).
import { getDb } from "./db.js";
import { PROVIDER_LIST } from "./providers.js";

const DEFAULT_OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL ?? "http://localhost:4096";

export const SETTINGS_KEYS = {
  enabledProviders: "enabled_providers",
  opencodeBaseUrl: "opencode_base_url",
};

function getValue(key, fallback = null) {
  const row = getDb().prepare("SELECT value FROM global_settings WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

function setValue(key, value) {
  getDb()
    .prepare(
      `INSERT INTO global_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, new Date().toISOString());
}

function parseJsonArray(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function seedDefaultGlobalSettings() {
  if (getDb().prepare("SELECT COUNT(*) AS c FROM global_settings").get().c === 0) {
    setValue(SETTINGS_KEYS.enabledProviders, JSON.stringify(PROVIDER_LIST.map((p) => p.id)));
    setValue(SETTINGS_KEYS.opencodeBaseUrl, DEFAULT_OPENCODE_BASE_URL);
  }
}

export function getGlobalSettings() {
  return {
    enabledProviders: parseJsonArray(
      getValue(SETTINGS_KEYS.enabledProviders, null),
      PROVIDER_LIST.map((p) => p.id)
    ),
    opencodeBaseUrl: getValue(SETTINGS_KEYS.opencodeBaseUrl, DEFAULT_OPENCODE_BASE_URL),
  };
}

export function getEnabledProviders() {
  return new Set(getGlobalSettings().enabledProviders);
}

export function isProviderEnabled(providerId) {
  return getEnabledProviders().has(providerId);
}

export function getOpencodeBaseUrl() {
  return getGlobalSettings().opencodeBaseUrl || DEFAULT_OPENCODE_BASE_URL;
}

export function updateGlobalSettings({ enabledProviders, opencodeBaseUrl }) {
  if (Array.isArray(enabledProviders)) {
    const valid = PROVIDER_LIST.map((p) => p.id);
    const cleaned = [...new Set(enabledProviders.filter((id) => valid.includes(id)))];
    setValue(SETTINGS_KEYS.enabledProviders, JSON.stringify(cleaned));
  }
  if (typeof opencodeBaseUrl === "string" && opencodeBaseUrl.trim()) {
    setValue(SETTINGS_KEYS.opencodeBaseUrl, opencodeBaseUrl.trim());
  }
  return getGlobalSettings();
}
