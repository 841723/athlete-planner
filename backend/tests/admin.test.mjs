import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DB_PATH = `/tmp/opencode/e2e/admin-${randomUUID()}.db`;
delete process.env.ADMIN_EMAILS;

const { getDb } = await import("../lib/db.js");
const { migrate } = await import("../lib/migrate.js");
const {
  getGlobalSettings,
  updateGlobalSettings,
  getEnabledProviders,
  isProviderEnabled,
  getOpencodeBaseUrl,
  seedDefaultGlobalSettings,
} = await import("../lib/global-settings.js");
const {
  upsertOpencodeModel,
  getCatalogModel,
  listCatalogModels,
  effectivePrice,
  mergeModelsWithCatalog,
} = await import("../lib/opencode-catalog.js");
const { createAthlete } = await import("../lib/athletes.js");
const { getProvidersList } = await import("../lib/ai-provider.js");
const { addMember, updateMemberRole, listMembers } = await import("../lib/members.js");
const { seedDefaultAiConfig, listAiConfigs, saveAiConfig, getAiConfigWithKey } = await import("../lib/ai-configs.js");

const migrated = migrate();
const tenantId = migrated.tenant.id;

test("seedDefaultGlobalSettings siembra proveedores y opencode por defecto", () => {
  seedDefaultGlobalSettings();
  const global = getGlobalSettings();
  assert.deepEqual(global.enabledProviders, ["gemini", "opencode", "mock"]);
  assert.equal(global.opencodeBaseUrl, "http://localhost:4096");
  assert.equal(isProviderEnabled("gemini"), true);
});

test("updateGlobalSettings filtra proveedores y guarda opencode_base_url", () => {
  updateGlobalSettings({ enabledProviders: ["gemini", "opencode", "inventado"], opencodeBaseUrl: "http://opencode:4096" });
  assert.deepEqual(getEnabledProviders(), new Set(["gemini", "opencode"]));
  assert.equal(getOpencodeBaseUrl(), "http://opencode:4096");
  assert.equal(isProviderEnabled("mock"), false);

  // getProvidersList solo devuelve los habilitados.
  const list = getProvidersList();
  assert.ok(!list.some((p) => p.id === "mock"));
  assert.ok(list.some((p) => p.id === "opencode"));

  updateGlobalSettings({ enabledProviders: ["gemini", "opencode", "mock"], opencodeBaseUrl: "http://localhost:4096" });
  assert.equal(isProviderEnabled("mock"), true);
});

test("catálogo opencode: upsert, listado, precio efectivo y merge", () => {
  upsertOpencodeModel({ modelId: "model-a", name: "Modelo A", providerId: "openai", enabled: true, inputPrice: 1.5, outputPrice: 6 });
  upsertOpencodeModel({ modelId: "model-b", name: "Modelo B", providerId: "anthropic", enabled: false, inputPrice: "", outputPrice: "" });

  const a = getCatalogModel("model-a");
  assert.equal(a.enabled, true);
  assert.equal(a.input_price, 1.5);

  assert.equal(listCatalogModels().length, 2);

  // Precio efectivo: catálogo si existe, instancia si no.
  assert.deepEqual(effectivePrice("model-a", { input_per_mtok: 9, output_per_mtok: 90 }), {
    input_per_mtok: 1.5,
    output_per_mtok: 6,
  });
  assert.deepEqual(effectivePrice("no-cat", { input_per_mtok: 9, output_per_mtok: 90 }), {
    input_per_mtok: 9,
    output_per_mtok: 90,
  });
  assert.equal(effectivePrice("no-cat", { input_per_mtok: null, output_per_mtok: null }), null);

  // mergeModelsWithCatalog marca enabled del catálogo (false por defecto).
  const merged = mergeModelsWithCatalog([
    { id: "model-a", name: "Modelo A", providerID: "openai", enabled: true, input_per_mtok: 9, output_per_mtok: 90 },
    { id: "model-b", name: "Modelo B", providerID: "anthropic", enabled: true, input_per_mtok: 3, output_per_mtok: 15 },
    { id: "model-c", name: "Modelo C", providerID: "x", enabled: true, input_per_mtok: 1, output_per_mtok: 2 },
  ]);
  const ma = merged.find((m) => m.id === "model-a");
  const mb = merged.find((m) => m.id === "model-b");
  const mc = merged.find((m) => m.id === "model-c");
  assert.equal(ma.enabled, true, "model-a habilitado por catálogo");
  assert.equal(ma.input_per_mtok, 1.5, "precio del catálogo");
  assert.equal(ma.overridden, true);
  assert.equal(mb.enabled, false, "model-b deshabilitado por catálogo");
  assert.equal(mc.enabled, false, "model fuera de catálogo deshabilitado");
  assert.equal(mc.input_per_mtok, 1);
});

test("createAthlete crea tenant + owner + seeds; rechaza slug duplicado", () => {
  const athlete = createAthlete({ name: "Sara", ownerEmail: "sara@example.com" });
  const db = getDb();
  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(athlete.id);
  assert.equal(tenant.slug, "sara");
  const members = listMembers(athlete.id);
  assert.equal(members.length, 1);
  assert.equal(members[0].role, "athlete");
  assert.equal(members[0].isOwner, true);
  assert.equal(members[0].email, "sara@example.com");
  assert.ok(listAiConfigs(athlete.id).length >= 1, "config de IA sembrada");

  assert.throws(() => createAthlete({ name: "Sara", ownerEmail: "sara@example.com" }), /Ya existe un tenant/);
});

test("members: admin puede asignar rol athlete; owner sigue protegido", () => {
  const admin = createAthlete({ name: "Dani", ownerEmail: "dani@example.com" });
  const added = addMember(admin.id, { email: "coach@example.com", role: "athlete" }, new Set(["athlete", "admin", "visitor"]));
  assert.equal(added.role, "athlete");

  updateMemberRole(admin.id, added.id, "visitor", new Set(["athlete", "admin", "visitor"]));
  const member = listMembers(admin.id).find((m) => m.id === added.id);
  assert.equal(member.role, "visitor");

  const owner = listMembers(admin.id).find((m) => m.isOwner);
  assert.throws(() => updateMemberRole(admin.id, owner.id, "visitor", new Set(["athlete", "admin", "visitor"])), /propietario/);
});

test("configs de IA: opencode se guarda con URL global, EUR/24h y sin precios por-tenant", () => {
  const id = saveAiConfig(tenantId, {
    name: "Config opencode",
    provider: "opencode",
    apiKey: "",
    model: "model-a",
    baseUrl: getOpencodeBaseUrl(),
    currency: "EUR",
    chatDurationHours: 24,
    pricing: null,
    isDefault: true,
  });
  const saved = getAiConfigWithKey(tenantId, id);
  assert.equal(saved.provider, "opencode");
  assert.equal(saved.base_url, getOpencodeBaseUrl());
  assert.equal(saved.currency, "EUR");
  assert.equal(saved.chat_duration_hours, 24);
  assert.equal(saved.api_key, "");
  assert.equal(saved.pricing, null);

  // Un proveedor genérico sí puede guardar su API key y precios propios.
  const gid = saveAiConfig(tenantId, {
    name: "Gemini custom",
    provider: "gemini",
    apiKey: "sk-test",
    model: "gemini-2.0-flash",
    baseUrl: "https://custom.example.com",
    currency: "USD",
    chatDurationHours: 12,
    pricing: { "gemini-2.0-flash": { input_per_mtok: 1, output_per_mtok: 4 } },
  });
  const g = getAiConfigWithKey(tenantId, gid);
  assert.equal(g.api_key, "sk-test");
  assert.equal(g.currency, "USD");
  assert.equal(g.chat_duration_hours, 12);
  assert.deepEqual(g.pricing["gemini-2.0-flash"], { input_per_mtok: 1, output_per_mtok: 4 });
});
