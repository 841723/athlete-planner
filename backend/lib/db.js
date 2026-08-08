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
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(loadInitSql());
  ensureColumn("goals", "url", "url TEXT");
  ensureColumn("goals", "is_primary", "is_primary INTEGER NOT NULL DEFAULT 0");
  ensureColumn("ai_provider_settings", "base_url", "base_url TEXT");
  ensureColumn("plans", "response_id", "response_id TEXT");
  return db;
}
