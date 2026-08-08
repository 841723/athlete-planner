#!/usr/bin/env node
// Elimina sesiones de la BD (completadas y/o planificadas) y sus tracks asociados.
// Uso:
//   node scripts/delete-sessions.mjs [--yes] [--tenant <id>] [--kind completed|planned|all]
//   --yes    elimina sin pedir confirmación (necesario en modo no interactivo)
//   --tenant restringe el borrado a un tenant concreto (por defecto: todos)
//   --kind   completed (realizadas), planned (planificadas) o all (por defecto)
// Requiere: backend DB (data/endurance.db).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../backend/lib/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, "data", "endurance.db");

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const yes = process.argv.includes("--yes");
const tenantId = arg("tenant");
const kind = arg("kind", "all");
if (!["completed", "planned", "all"].includes(kind)) die(`--kind debe ser completed, planned o all (recibido: ${kind})`);

const db = getDb();

const where = [];
const params = [];
if (tenantId) {
  where.push("tenant_id = ?");
  params.push(tenantId);
}
if (kind !== "all") {
  where.push("kind = ?");
  params.push(kind);
}
const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

const { total } = db.prepare(`SELECT COUNT(*) AS total FROM sessions${whereSql}`).get(...params);
if (!total) {
  console.log("No hay sesiones que eliminar.");
  process.exit(0);
}

const byKind = {};
for (const k of ["completed", "planned"]) {
  const kindWhere = where.length ? [...where, "kind = ?"] : ["kind = ?"];
  const q = [...params, k];
  byKind[k] = db.prepare(`SELECT COUNT(*) AS total FROM sessions WHERE ${kindWhere.join(" AND ")}`).get(...q).total;
}

console.log(`Se van a eliminar ${total} sesiones:`);
if (tenantId) console.log(`  Tenant: ${tenantId}`);
else console.log("  Tenant: todos");
console.log(`  Completadas: ${byKind.completed}`);
console.log(`  Planificadas: ${byKind.planned}`);

if (!yes) {
  process.stdout.write("¿Continuar? (s/N): ");
  await new Promise((resolve) => {
    process.stdin.once("data", (chunk) => resolve(chunk));
  }).then((chunk) => {
    const answer = String(chunk).trim().toLowerCase();
    if (answer !== "s" && answer !== "si" && answer !== "y" && answer !== "yes") {
      console.log("Cancelado.");
      process.exit(0);
    }
  });
}

db.exec("BEGIN");
try {
  const sessionsResult = db.prepare(`DELETE FROM sessions${whereSql}`).run(...params);
  const tenantFilter = tenantId ? "tenant_id = ? AND" : "";
  const tenantParams = tenantId ? [tenantId] : [];
  const tracksResult = db
    .prepare(
      `DELETE FROM activity_tracks WHERE ${tenantFilter} (tenant_id, session_id) NOT IN
       (SELECT tenant_id, id FROM sessions)`
    )
    .run(...tenantParams);
  db.exec("COMMIT");
  console.log(`Sesiones eliminadas: ${sessionsResult.changes}`);
  console.log(`Tracks huérfanos eliminados: ${tracksResult.changes}`);
  console.log(`BD: ${DB_PATH}`);
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}
