// Catálogo global de modelos de opencode gestionado por el administrador.
// El catálogo es una capa sobre la instancia: qué modelos están disponibles
// (`enabled`) y a qué precio (`input_price`/`output_price`, si se fijan;
// si no, se mantiene el que expone la instancia).
import { getDb } from "./db.js";

function rowToModel(row) {
  if (!row) return null;
  return {
    modelId: row.model_id,
    provider: row.provider,
    name: row.name,
    providerID: row.provider_id,
    enabled: Boolean(row.enabled),
    input_price: row.input_price == null ? null : Number(row.input_price),
    output_price: row.output_price == null ? null : Number(row.output_price),
    currency: row.currency ?? "EUR",
  };
}

export function getCatalogModel(modelId, provider = "opencode") {
  const row = getDb().prepare("SELECT * FROM ai_model_catalog WHERE provider = ? AND model_id = ?").get(provider, modelId);
  return rowToModel(row);
}

export function listCatalogModels() {
  return getDb().prepare("SELECT * FROM ai_model_catalog WHERE provider = 'opencode' ORDER BY model_id").all().map(rowToModel);
}

export function upsertOpencodeModel({ modelId, name, providerId, enabled, inputPrice, outputPrice, currency = "EUR" }) {
  if (!modelId || typeof modelId !== "string" || !modelId.trim()) {
    const err = new Error("Falta model_id");
    err.status = 400;
    throw err;
  }
  const num = (v) => (v == null || v === "" ? null : Number(v));
  const i = num(inputPrice);
  const o = num(outputPrice);
  if ((i != null && !Number.isFinite(i)) || (o != null && !Number.isFinite(o))) {
    const err = new Error("Precios inválidos");
    err.status = 400;
    throw err;
  }
  getDb()
    .prepare(
      `INSERT INTO ai_model_catalog (provider, model_id, provider_id, name, enabled, input_price, output_price, currency, updated_at)
       VALUES ('opencode', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, model_id) DO UPDATE SET
          name = excluded.name,
          provider_id = excluded.provider_id,
         enabled = excluded.enabled,
         input_price = excluded.input_price,
          output_price = excluded.output_price,
          currency = excluded.currency,
         updated_at = excluded.updated_at`
    )
    .run(
      modelId,
      name ?? null,
      providerId ?? null,
      enabled ? 1 : 0,
      i,
      o,
      currency,
      new Date().toISOString()
    );
  return getCatalogModel(modelId, "opencode");
}

export function deleteOpencodeModel(modelId) {
  return getDb().prepare("DELETE FROM ai_model_catalog WHERE provider = 'opencode' AND model_id = ?").run(modelId).changes > 0;
}

// Precio efectivo: el del catálogo si existe, si no el de la instancia.
export function effectivePrice(modelId, apiPrice, provider = "opencode") {
  const cat = getCatalogModel(modelId, provider);
  if (cat && (cat.input_price != null || cat.output_price != null)) {
    return {
      input_per_mtok: cat.input_price ?? apiPrice?.input_per_mtok ?? null,
      output_per_mtok: cat.output_price ?? apiPrice?.output_per_mtok ?? null,
    };
  }
  return apiPrice && (apiPrice.input_per_mtok != null || apiPrice.output_per_mtok != null)
    ? { input_per_mtok: apiPrice.input_per_mtok, output_per_mtok: apiPrice.output_per_mtok }
    : null;
}

// Fusiona los modelos de la instancia con el catálogo global.
// Un modelo solo está disponible para los tenants si está habilitado en el catálogo.
export function mergeModelsWithCatalog(models) {
  return models.map((m) => {
    const cat = getCatalogModel(m.id, "opencode");
    const price = effectivePrice(m.id, {
      input_per_mtok: m.input_per_mtok,
      output_per_mtok: m.output_per_mtok,
    });
    return {
      ...m,
      enabled: Boolean(cat?.enabled && cat.input_price != null && cat.output_price != null),
      input_per_mtok: price?.input_per_mtok ?? null,
      output_per_mtok: price?.output_per_mtok ?? null,
      currency: cat?.currency ?? null,
      overridden: !!cat && (cat.input_price != null || cat.output_price != null),
      in_catalog: !!cat,
    };
  });
}
