// Catálogo global de modelos de opencode gestionado por el administrador.
// El catálogo es una capa sobre la instancia: qué modelos están disponibles
// (`enabled`) y a qué precio (`input_price`/`output_price`, si se fijan;
// si no, se mantiene el que expone la instancia).
import { getDb } from "./db.js";

function rowToModel(row) {
  if (!row) return null;
  return {
    modelId: row.model_id,
    name: row.name,
    providerID: row.provider_id,
    enabled: Boolean(row.enabled),
    input_price: row.input_price == null ? null : Number(row.input_price),
    output_price: row.output_price == null ? null : Number(row.output_price),
  };
}

export function getCatalogModel(modelId) {
  const row = getDb().prepare("SELECT * FROM opencode_models WHERE model_id = ?").get(modelId);
  return rowToModel(row);
}

export function listCatalogModels() {
  return getDb().prepare("SELECT * FROM opencode_models").all().map(rowToModel);
}

export function upsertOpencodeModel({ modelId, name, providerId, enabled, inputPrice, outputPrice }) {
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
      `INSERT INTO opencode_models (model_id, name, provider_id, enabled, input_price, output_price, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(model_id) DO UPDATE SET
         name = excluded.name,
         provider_id = excluded.provider_id,
         enabled = excluded.enabled,
         input_price = excluded.input_price,
         output_price = excluded.output_price,
         updated_at = excluded.updated_at`
    )
    .run(
      modelId,
      name ?? null,
      providerId ?? null,
      enabled ? 1 : 0,
      i,
      o,
      new Date().toISOString()
    );
  return getCatalogModel(modelId);
}

// Precio efectivo: el del catálogo si existe, si no el de la instancia.
export function effectivePrice(modelId, apiPrice) {
  const cat = getCatalogModel(modelId);
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
    const cat = getCatalogModel(m.id);
    const price = effectivePrice(m.id, {
      input_per_mtok: m.input_per_mtok,
      output_per_mtok: m.output_per_mtok,
    });
    return {
      ...m,
      enabled: cat ? cat.enabled : false,
      input_per_mtok: price?.input_per_mtok ?? null,
      output_per_mtok: price?.output_per_mtok ?? null,
      overridden: !!cat && (cat.input_price != null || cat.output_price != null),
      in_catalog: !!cat,
    };
  });
}
