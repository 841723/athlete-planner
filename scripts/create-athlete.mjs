#!/usr/bin/env node
// Crea un nuevo atleta: tenant + owner (role athlete, is_owner) + perfil opcional.
// Uso:
//   node scripts/create-athlete.mjs --name "Sara" --owner-email sara@example.com \
//     --profile data/athlete-profile.example.json [--slug sara] [--min-date 2026-05-12]
// Requiere: backend DB (se crea en data/endurance.db si no existe).
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../backend/lib/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MIN_DATE = "2026-05-12";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const name = arg("name");
const ownerEmail = arg("owner-email");
if (!name) die("Falta --name \"<nombre del atleta>\"");
if (!ownerEmail) die("Falta --owner-email <email> (debe coincidir con su cuenta de Google)");

const slug = arg("slug") ?? slugify(name);
const profilePath = arg("profile");
const minDate = arg("min-date", DEFAULT_MIN_DATE);

const db = getDb();
const existing = db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slug);
if (existing) die(`Ya existe un tenant con slug "${slug}". No se hizo nada.`);

const tenantId = randomUUID();
const now = new Date().toISOString();
db.exec("BEGIN");

try {
  db.prepare(
    "INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)"
  ).run(tenantId, name, slug, now);

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(ownerEmail);
  if (!user) {
    const userId = randomUUID();
    db.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId, null, ownerEmail, ownerEmail.split("@")[0], null, now);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }
  db.prepare(
    "INSERT INTO tenant_members (tenant_id, user_id, role, is_owner, created_at) VALUES (?, ?, 'athlete', 1, ?)"
  ).run(tenantId, user.id, now);

  db.prepare(
    `INSERT INTO tenant_settings (tenant_id, plan_start, goal_date, training_week_one_start, min_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tenantId, arg("plan-start") ?? "2026-05-12", arg("goal-date") ?? "", arg("training-week-one-start") ?? "2026-05-11", minDate);

  let hasProfile = false;
  if (profilePath) {
    const full = path.resolve(ROOT, profilePath);
    if (!fs.existsSync(full)) die(`No existe el perfil: ${full}`);
    const profile = JSON.parse(fs.readFileSync(full, "utf8"));
    db.prepare(
      "INSERT INTO athlete_profiles (tenant_id, data, updated_at) VALUES (?, ?, ?)"
    ).run(tenantId, JSON.stringify(profile), now);
    hasProfile = true;
  }

  db.exec("COMMIT");
  console.log("Atleta creado:");
  console.log(`  Tenant: ${name} (${slug})`);
  console.log(`  Tenant id: ${tenantId}`);
  console.log(`  Owner: ${ownerEmail}`);
  console.log(`  Perfil importado: ${hasProfile ? "sí" : "no"}`);
  console.log(`  MIN_DATE: ${minDate}`);
  console.log("");
  console.log("El owner debe iniciar sesión con Google (email coincidente) y cambiar al tenant en el selector.");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}
