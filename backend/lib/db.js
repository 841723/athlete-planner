import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(import.meta.dirname, "..", "..", "data");
export const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "endurance.db");

let db = null;

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table);
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

const INIT_SQL_PATH = path.resolve(import.meta.dirname, "..", "init.sql");

function loadInitSql() {
  try {
    return fs.readFileSync(INIT_SQL_PATH, "utf8");
  } catch {
    throw new Error("No se pudo cargar backend/init.sql con el esquema de la BD");
  }
}

function migrateActivityIds() {
  const db = getDbInstance();
  const migration = "activities-internal-ids-v1";
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(migration)) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    const completed = db.prepare("SELECT tenant_id, id, data FROM sessions WHERE kind = 'completed'").all();
    const idMap = new Map();
    const insert = db.prepare(
      "INSERT INTO sessions (tenant_id, id, kind, sport, start_date_local, title, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const remove = db.prepare("DELETE FROM sessions WHERE tenant_id = ? AND id = ?");
    const sourceInsert = db.prepare(
      "INSERT OR IGNORE INTO activity_sources (activity_id, tenant_id, source, external_activity_id, metadata, created_at, updated_at) VALUES (?, ?, 'garmin', ?, NULL, ?, ?)"
    );
    const now = new Date().toISOString();

    for (const row of completed) {
      const internalId = randomUUID();
      idMap.set(`${row.tenant_id}:${row.id}`, internalId);
      const data = JSON.parse(row.data);
      data.id = internalId;
      data.source = data.source ?? "garmin";
      data.external_id = data.external_id ?? String(row.id);
      insert.run(
        row.tenant_id,
        internalId,
        "completed",
        data.sport ?? null,
        data.start_date_local ?? null,
        data.title ?? null,
        data.name ?? null,
        JSON.stringify(data),
        now,
        now,
      );
      sourceInsert.run(internalId, row.tenant_id, String(row.id), now, now);
    }

    const planned = db.prepare("SELECT tenant_id, id, data FROM sessions WHERE kind = 'planned'").all();
    for (const row of planned) {
      const data = JSON.parse(row.data);
      const old = data.merged_with ? idMap.get(`${row.tenant_id}:${data.merged_with}`) : null;
      if (old) {
        data.merged_with = old;
        db.prepare("UPDATE sessions SET data = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
          .run(JSON.stringify(data), now, row.tenant_id, row.id);
      }
    }
    for (const row of completed) remove.run(row.tenant_id, row.id);
    db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(migration, now);
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore rollback failure */ }
    throw error;
  }
}

function getDbInstance() {
  return db;
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(loadInitSql());
  db.exec("DROP TABLE IF EXISTS activity_tracks;");
  ensureColumn("users", "is_superadmin", "is_superadmin INTEGER NOT NULL DEFAULT 0");
  ensureColumn("goals", "url", "url TEXT");
  ensureColumn("goals", "is_primary", "is_primary INTEGER NOT NULL DEFAULT 0");
  ensureColumn("goals", "color", "color TEXT");
  ensureColumn("ai_provider_settings", "base_url", "base_url TEXT");
  ensureColumn("ai_provider_settings", "currency", "currency TEXT NOT NULL DEFAULT 'EUR'");
  ensureColumn("ai_provider_settings", "chat_duration_hours", "chat_duration_hours INTEGER NOT NULL DEFAULT 24");
  ensureColumn("ai_provider_settings", "pricing", "pricing TEXT");
  ensureColumn("plans", "response_id", "response_id TEXT");
  ensureColumn("plans", "ai_config_id", "ai_config_id TEXT");
  ensureColumn("plans", "status", "status TEXT NOT NULL DEFAULT 'completed'");
  ensureColumn("plans", "error", "error TEXT");
  ensureColumn("plans", "request_comments", "request_comments TEXT");
  ensureColumn("plans", "started_at", "started_at TEXT");
  ensureColumn("plans", "finished_at", "finished_at TEXT");
  ensureColumn("plans", "chat_pending", "chat_pending INTEGER NOT NULL DEFAULT 0");
  ensureColumn("plans", "context_hash", "context_hash TEXT");
  ensureColumn("plans", "active", "active INTEGER NOT NULL DEFAULT 0");
  ensureColumn("plans", "chat_instructions", "chat_instructions TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_one_active ON plans(tenant_id) WHERE active = 1");
  ensureColumn("ai_logs", "input_tokens", "input_tokens INTEGER");
  ensureColumn("ai_logs", "output_tokens", "output_tokens INTEGER");
  ensureColumn("ai_logs", "cost", "cost REAL");
  ensureColumn("ai_logs", "currency", "currency TEXT");
  ensureColumn("ai_logs", "operation_type", "operation_type TEXT");
  ensureColumn("ai_prompts", "role", "role TEXT NOT NULL DEFAULT 'plan'");
  ensureColumn("tenant_settings", "focus_sports", "focus_sports TEXT");
  ensureColumn("ai_model_catalog", "provider_id", "provider_id TEXT");
  db.exec(`INSERT OR IGNORE INTO ai_model_catalog
    (provider, model_id, provider_id, name, enabled, input_price, output_price, currency, updated_at)
    SELECT 'opencode', model_id, provider_id, name, enabled, input_price, output_price, 'EUR', updated_at
    FROM opencode_models`);
  migrateActivityIds();
  return db;
}
