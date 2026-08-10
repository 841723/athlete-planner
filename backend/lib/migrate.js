import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { upsertSession } from "./sessions.js";
import { seedDefaultEquipment } from "./equipment.js";
import { seedDefaultAiConfig } from "./ai-configs.js";
import { seedDefaultGlobalSettings } from "./global-settings.js";
import { syncSuperAdmins } from "./auth.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SESSIONS_DIR = path.join(ROOT, "sessions");
const PLANNED_DIR = path.join(SESSIONS_DIR, "planned");
const DATA_DIR = process.env.DATA_DIR ?? path.join(ROOT, "data");
const PROFILE_PATH = path.join(DATA_DIR, "athlete-profile.json");

const DEFAULT_MIN_DATE = "2026-05-12";

// Objetivos del tenant por defecto (datos del atleta actual, se migran una sola vez a la BD).
const DEFAULT_GOALS = [
  { week: 21, label: "Media Maratón Logroño", date: "2026-10-04", targetPace: "5:00 min/km" },
  { week: 24, label: "10K Caixabank", date: "2026-10-25", targetPace: "—" },
  { week: 49, label: "IRONMAN 70.3 Valencia", date: "2027-04-18", targetPace: "—" },
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function importCompletedSessions(tenantId) {
  const db = getDb();
  if (!fs.existsSync(SESSIONS_DIR)) return 0;
  let count = 0;
  for (const file of fs.readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    if (file === "all.json" || file === "missing.json") continue;
    const full = path.join(SESSIONS_DIR, file);
    if (fs.statSync(full).isDirectory()) continue;
    const s = readJson(full);
    if (!s?.id) continue;
    upsertSession(tenantId, "completed", s);
    count++;
  }
  return count;
}

function importPlannedSessions(tenantId) {
  if (!fs.existsSync(PLANNED_DIR)) return 0;
  let count = 0;
  for (const file of fs.readdirSync(PLANNED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const s = readJson(path.join(PLANNED_DIR, file));
    if (!s?.id) continue;
    upsertSession(tenantId, "planned", s);
    count++;
  }
  return count;
}

function importProfile(tenantId) {
  const db = getDb();
  const profile = readJson(PROFILE_PATH);
  if (profile) {
    db.prepare(
      `INSERT INTO athlete_profiles (tenant_id, data, updated_at) VALUES (?, ?, ?)`
    ).run(tenantId, JSON.stringify(profile), new Date().toISOString());
    return true;
  }
  return false;
}

function seedGoals(tenantId) {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO goals (tenant_id, week, label, date, target_pace) VALUES (?, ?, ?, ?, ?)"
  );
  for (const g of DEFAULT_GOALS) {
    insert.run(tenantId, g.week, g.label, g.date, g.targetPace);
  }
}

function seedSettings(tenantId) {
  const db = getDb();
  db.prepare(
    `INSERT INTO tenant_settings (tenant_id, plan_start, goal_date, training_week_one_start, min_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    tenantId,
    "2026-05-12",
    "2027-04-18",
    "2026-05-11",
    process.env.MIN_DATE ?? DEFAULT_MIN_DATE
  );
}

function seedOwner(tenantId) {
  const db = getDb();
  const email = process.env.DEFAULT_OWNER_EMAIL;
  if (!email) return null;
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, null, email, email.split("@")[0], null, new Date().toISOString());
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }
  db.prepare(
    "INSERT INTO tenant_members (tenant_id, user_id, role, is_owner, created_at) VALUES (?, ?, 'athlete', 1, ?)"
  ).run(tenantId, user.id, new Date().toISOString());
  return user;
}

export function migrate() {
  const db = getDb();
  seedDefaultGlobalSettings();
  syncSuperAdmins();

  const hasTenants = db.prepare("SELECT COUNT(*) AS c FROM tenants").get().c > 0;
  if (hasTenants) {
    return { migrated: false, reason: "ya-migrado", tenant: null };
  }

  const tenantId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)"
  ).run(tenantId, "Atleta principal", "default", now);

  const completed = importCompletedSessions(tenantId);
  const planned = importPlannedSessions(tenantId);
  const hasProfile = importProfile(tenantId);
  seedGoals(tenantId);
  seedSettings(tenantId);
  seedDefaultEquipment(tenantId);
  seedDefaultAiConfig(tenantId);
  const owner = seedOwner(tenantId);

  return {
    migrated: true,
    tenant: { id: tenantId, name: "Atleta principal", slug: "default" },
    completed,
    planned,
    hasProfile,
    ownerEmail: owner?.email ?? null,
  };
}
