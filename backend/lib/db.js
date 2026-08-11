import { DatabaseSync } from "node:sqlite";
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
  ensureColumn("ai_logs", "input_tokens", "input_tokens INTEGER");
  ensureColumn("ai_logs", "output_tokens", "output_tokens INTEGER");
  ensureColumn("ai_logs", "cost", "cost REAL");
  ensureColumn("ai_logs", "currency", "currency TEXT");
  ensureColumn("ai_prompts", "role", "role TEXT NOT NULL DEFAULT 'plan'");
  ensureColumn("tenant_settings", "focus_sports", "focus_sports TEXT");
  ensureColumn("ai_model_catalog", "provider_id", "provider_id TEXT");
  db.exec(`INSERT OR IGNORE INTO ai_model_catalog
    (provider, model_id, provider_id, name, enabled, input_price, output_price, currency, updated_at)
    SELECT 'opencode', model_id, provider_id, name, enabled, input_price, output_price, 'EUR', updated_at
    FROM opencode_models`);
  return db;
}
