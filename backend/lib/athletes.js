// Creación de atletas (tenant + owner + seeds). Lo usan scripts/create-athlete.mjs
// y la API de administración (POST /api/admin/tenants).
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { seedDefaultEquipment } from "./equipment.js";
import { seedDefaultAiConfig } from "./ai-configs.js";
import { seedTenantPrompts } from "./ai-prompts.js";
import { seedDefaultGlobalSettings } from "./global-settings.js";

export const DEFAULT_MIN_DATE = "2026-05-12";

export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createAthlete({ name, ownerEmail, slug, minDate, planStart, goalDate, trainingWeekOneStart, profile }) {
  const db = getDb();
  if (!name || typeof name !== "string" || !name.trim()) {
    const err = new Error("Falta el nombre del atleta");
    err.status = 400;
    throw err;
  }
  if (!ownerEmail || typeof ownerEmail !== "string" || !ownerEmail.includes("@")) {
    const err = new Error("Falta el email del owner (debe coincidir con su cuenta de Google)");
    err.status = 400;
    throw err;
  }
  const finalSlug = slug || slugify(name);
  if (db.prepare("SELECT id FROM tenants WHERE slug = ?").get(finalSlug)) {
    const err = new Error(`Ya existe un tenant con slug "${finalSlug}". No se hizo nada.`);
    err.status = 409;
    throw err;
  }

  seedDefaultGlobalSettings();
  const tenantId = randomUUID();
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)").run(
      tenantId,
      name.trim(),
      finalSlug,
      now
    );

    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(ownerEmail.toLowerCase());
    if (!user) {
      const userId = randomUUID();
      db.prepare(
        "INSERT INTO users (id, google_sub, email, name, picture, is_superadmin, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)"
      ).run(userId, null, ownerEmail.toLowerCase(), ownerEmail.split("@")[0], null, now);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    }
    db.prepare(
      "INSERT INTO tenant_members (tenant_id, user_id, role, is_owner, created_at) VALUES (?, ?, 'athlete', 1, ?)"
    ).run(tenantId, user.id, now);

    db.prepare(
      `INSERT INTO tenant_settings (tenant_id, plan_start, goal_date, training_week_one_start, min_date)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      tenantId,
      planStart || DEFAULT_MIN_DATE,
      goalDate || "",
      trainingWeekOneStart || "2026-05-11",
      minDate || DEFAULT_MIN_DATE
    );

    if (profile && typeof profile === "object") {
      db.prepare(
        "INSERT INTO athlete_profiles (tenant_id, data, updated_at) VALUES (?, ?, ?)"
      ).run(tenantId, JSON.stringify(profile), now);
    }

    seedDefaultEquipment(tenantId);
    seedDefaultAiConfig(tenantId);
    seedTenantPrompts(tenantId);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    id: tenantId,
    name: name.trim(),
    slug: finalSlug,
    ownerEmail: ownerEmail.toLowerCase(),
  };
}
