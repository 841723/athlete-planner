import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PLANNED_DIR, enrich } from "./sessions.js";
import { buildObjectives } from "./objectives.js";

const slugify = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "actividad";

function readSessionFile(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    return s?.id ? s : null;
  } catch {
    return null;
  }
}

function plannedFilename(session) {
  const date = (session.start_date_local ?? "").slice(0, 10).replace(/-/g, "") || "sinfecha";
  return `${date}-${session.id}-${slugify(session.name ?? "planificada")}.json`;
}

function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw err;
  }
}

function findFileById(id) {
  if (!fs.existsSync(PLANNED_DIR)) return null;
  const wanted = String(id);
  for (const file of fs.readdirSync(PLANNED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const s = readSessionFile(path.join(PLANNED_DIR, file));
    if (s && String(s.id) === wanted) return file;
  }
  return null;
}

export function listPlanned() {
  if (!fs.existsSync(PLANNED_DIR)) return [];
  const sessions = [];
  for (const file of fs.readdirSync(PLANNED_DIR)) {
    if (!file.endsWith(".json")) continue;
    const s = readSessionFile(path.join(PLANNED_DIR, file));
    if (s) sessions.push(enrich(s));
  }
  sessions.sort((a, b) => (a.start_date_local ?? "").localeCompare(b.start_date_local ?? ""));
  return sessions.map((s) => ({ ...s, objectives: buildObjectives(s) }));
}

export function createPlanned(payload) {
  const sport = payload?.sport;
  const start = payload?.start_date_local;
  if (!sport || !start) {
    const err = new Error("Faltan campos obligatorios (sport, start_date_local)");
    err.status = 400;
    throw err;
  }
  const session = {
    ...payload,
    schema_version: 2,
    id: randomUUID(),
  };
  fs.mkdirSync(PLANNED_DIR, { recursive: true });
  writeAtomic(path.join(PLANNED_DIR, plannedFilename(session)), session);
  return { ...enrich(session), objectives: buildObjectives(session) };
}

export function updatePlanned(id, payload) {
  const file = findFileById(id);
  if (!file) {
    const err = new Error("Planificada no encontrada");
    err.status = 404;
    throw err;
  }
  const old = readSessionFile(path.join(PLANNED_DIR, file));
  if (!old) {
    const err = new Error("Error leyendo planificada");
    err.status = 500;
    throw err;
  }
  const merged = { ...old, ...payload, id: String(id) };
  const newFile = plannedFilename(merged);
  writeAtomic(path.join(PLANNED_DIR, newFile), merged);
  if (newFile !== file) {
    fs.rmSync(path.join(PLANNED_DIR, file), { force: true });
  }
  return { ...enrich(merged), objectives: buildObjectives(merged) };
}

export function deletePlanned(id) {
  const file = findFileById(id);
  if (!file) {
    const err = new Error("Planificada no encontrada");
    err.status = 404;
    throw err;
  }
  fs.rmSync(path.join(PLANNED_DIR, file), { force: true });
}
