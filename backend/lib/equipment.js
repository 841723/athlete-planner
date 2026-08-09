import { getDb } from "./db.js";

export const EQUIPMENT_CATALOG = [
  {
    category: "running",
    label: "Carrera",
    items: [
      { id: "run_shoes", label: "Zapatillas de running", emoji: "👟" },
      { id: "run_road", label: "Acceso a carretera/parque", emoji: "🏞️" },
      { id: "trail", label: "Acceso a trail/montaña", emoji: "⛰️" },
    ],
  },
  {
    category: "cycling",
    label: "Bicicleta",
    items: [
      { id: "road_bike", label: "Bicicleta de carretera", emoji: "🚴" },
      { id: "smart_trainer", label: "Rodillo inteligente", emoji: "⚙️" },
      { id: "indoor_bike", label: "Bicicleta estática", emoji: "🚵" },
      { id: "cycling_shoes", label: "Zapatillas con calas", emoji: "👞" },
      { id: "helmet", label: "Casco", emoji: "🪖" },
      { id: "aerobars", label: "Acoples", emoji: "🛠️" },
    ],
  },
  {
    category: "swimming",
    label: "Natación",
    items: [
      { id: "pool_25", label: "Piscina de 25 m", emoji: "🏊" },
      { id: "pool_50", label: "Piscina de 50 m", emoji: "🏊" },
      { id: "open_water", label: "Acceso a mar abierto", emoji: "🌊" },
      { id: "wetsuit", label: "Traje de neopreno", emoji: "🤿" },
      { id: "goggles", label: "Gafas de natación", emoji: "🥽" },
      { id: "pull_buoy", label: "Pull buoy", emoji: "🛟" },
      { id: "paddles", label: "Palas", emoji: "🛟" },
      { id: "fins", label: "Aletas", emoji: "🦶" },
    ],
  },
  {
    category: "strength",
    label: "Fuerza",
    items: [
      { id: "squat_rack", label: "Rack de sentadillas", emoji: "🏋️" },
      { id: "barbell", label: "Barra", emoji: "🏋️" },
      { id: "dumbbells", label: "Mancuernas", emoji: "🏋️" },
      { id: "bench", label: "Banco", emoji: "🪑" },
      { id: "pullup_bar", label: "Barra de dominadas", emoji: "🧗" },
      { id: "kettlebells", label: "Kettlebells", emoji: "🏋️" },
      { id: "plates", label: "Discos", emoji: "⚙️" },
    ],
  },
  {
    category: "other",
    label: "Otros",
    items: [
      { id: "garmin_watch", label: "Reloj Garmin", emoji: "⌚" },
      { id: "hr_strap", label: "Banda de frecuencia cardiaca", emoji: "❤️" },
      { id: "power_meter", label: "Medidor de potencia", emoji: "📊" },
      { id: "padel_racket", label: "Pala de pádel", emoji: "🏓" },
      { id: "gym_membership", label: "Acceso a gimnasio", emoji: "🏢" },
    ],
  },
];

export const DEFAULT_EQUIPMENT = [
  { item: "Zapatillas de running", category: "running" },
  { item: "Acceso a carretera/parque", category: "running" },
  { item: "Bicicleta de carretera", category: "cycling" },
  { item: "Rodillo inteligente", category: "cycling" },
  { item: "Piscina de 25 m", category: "swimming" },
  { item: "Mancuernas", category: "strength" },
  { item: "Banco", category: "strength" },
  { item: "Reloj Garmin", category: "other" },
  { item: "Banda de frecuencia cardiaca", category: "other" },
  { item: "Pala de pádel", category: "other" },
];

export function seedDefaultEquipment(tenantId) {
  const stmt = getDb().prepare(
    "INSERT OR IGNORE INTO athlete_equipment (tenant_id, item, category, quantity) VALUES (?, ?, ?, 1)"
  );
  for (const it of DEFAULT_EQUIPMENT) {
    stmt.run(tenantId, it.item, it.category);
  }
}

export function getEquipment(tenantId) {
  return getDb()
    .prepare(
      "SELECT item, category, quantity FROM athlete_equipment WHERE tenant_id = ? ORDER BY category, item"
    )
    .all(tenantId);
}

export function getEquipmentLabels(tenantId) {
  return getEquipment(tenantId).map((e) => e.item);
}

function seedCatalogIfEmpty(tenantId) {
  const db = getDb();
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM equipment_catalog WHERE tenant_id = ?")
    .get(tenantId);
  if (n > 0) return;
  const insCat = getDb().prepare(
    "INSERT OR IGNORE INTO equipment_categories (tenant_id, category, label, emoji, sort) VALUES (?, ?, ?, ?, ?)"
  );
  const insItem = getDb().prepare(
    "INSERT OR IGNORE INTO equipment_catalog (tenant_id, category, item, emoji, sort) VALUES (?, ?, ?, ?, ?)"
  );
  EQUIPMENT_CATALOG.forEach((cat, ci) => {
    insCat.run(tenantId, cat.category, cat.label, "", ci);
    cat.items.forEach((it, ii) => insItem.run(tenantId, cat.category, it.label, it.emoji, ii));
  });
  // Migración: ítems que el tenant poseía y no están en el catálogo por defecto
  // (p. ej. personalizados antiguos) se añaden a su categoría para no perderlos.
  const owned = getEquipment(tenantId);
  const inCatalog = new Set(
    db.prepare("SELECT item FROM equipment_catalog WHERE tenant_id = ?").all(tenantId).map((r) => r.item)
  );
  for (const ow of owned) {
    if (inCatalog.has(ow.item)) continue;
    const catKey = EQUIPMENT_CATALOG.some((c) => c.category === ow.category) ? ow.category : "other";
    const catDef = EQUIPMENT_CATALOG.find((c) => c.category === catKey);
    const exists = db
      .prepare("SELECT 1 FROM equipment_categories WHERE tenant_id = ? AND category = ?")
      .get(tenantId, catKey);
    if (!exists) insCat.run(tenantId, catKey, catDef?.label ?? catKey, "", 999);
    insItem.run(tenantId, catKey, ow.item, "", 999);
  }
}

export function getEquipmentCatalog(tenantId) {
  seedCatalogIfEmpty(tenantId);
  const db = getDb();
  const cats = db
    .prepare("SELECT category, label, emoji, sort FROM equipment_categories WHERE tenant_id = ? ORDER BY sort, category")
    .all(tenantId);
  const items = db
    .prepare("SELECT category, item, emoji, sort FROM equipment_catalog WHERE tenant_id = ? ORDER BY sort, item")
    .all(tenantId);
  return cats.map((c) => ({
    category: c.category,
    label: c.label,
    emoji: c.emoji || "",
    items: items
      .filter((i) => i.category === c.category)
      .map((i) => ({ id: i.item, label: i.item, emoji: i.emoji })),
  }));
}

export function saveEquipmentCatalog(tenantId, catalog) {
  const db = getDb();
  db.prepare("DELETE FROM equipment_categories WHERE tenant_id = ?").run(tenantId);
  db.prepare("DELETE FROM equipment_catalog WHERE tenant_id = ?").run(tenantId);
  const insCat = db.prepare(
    "INSERT INTO equipment_categories (tenant_id, category, label, emoji, sort) VALUES (?, ?, ?, ?, ?)"
  );
  const insItem = db.prepare(
    "INSERT INTO equipment_catalog (tenant_id, category, item, emoji, sort) VALUES (?, ?, ?, ?, ?)"
  );
  (catalog ?? []).forEach((cat, ci) => {
    const category = String(cat?.category ?? "").trim().slice(0, 50);
    if (!category) return;
    insCat.run(
      tenantId,
      category,
      String(cat?.label ?? category).trim().slice(0, 50),
      String(cat?.emoji ?? "").slice(0, 20),
      ci
    );
    (cat?.items ?? []).forEach((it, ii) => {
      const item = String(it?.label ?? "").trim().slice(0, 200);
      if (!item) return;
      insItem.run(tenantId, category, item, String(it?.emoji ?? "").slice(0, 20), ii);
    });
  });
}

export function saveEquipment(tenantId, items) {
  getDb().prepare("DELETE FROM athlete_equipment WHERE tenant_id = ?").run(tenantId);
  const stmt = getDb().prepare(
    "INSERT INTO athlete_equipment (tenant_id, item, category, quantity) VALUES (?, ?, ?, ?)"
  );
  for (const it of items ?? []) {
    const item = String(it?.item ?? "").trim();
    if (!item) continue;
    stmt.run(
      tenantId,
      item.slice(0, 200),
      String(it?.category ?? "other").slice(0, 50),
      Math.max(1, Math.round(Number(it?.quantity) || 1))
    );
  }
}
