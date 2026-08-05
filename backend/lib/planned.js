import { randomUUID } from "node:crypto";
import { getTenantId, loadPlannedSessions, enrich, getSession, updateSession, deleteSession, upsertSession } from "./sessions.js";
import { buildObjectives } from "./objectives.js";

function withObjectives(session) {
  if (!session) return null;
  return { ...session, objectives: buildObjectives(session) };
}

export function listPlanned() {
  return loadPlannedSessions()
    .sort((a, b) => (a.start_date_local ?? "").localeCompare(b.start_date_local ?? ""))
    .map((s) => withObjectives(s));
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
  upsertSession(getTenantId(), "planned", session);
  return withObjectives(enrich(session));
}

export function updatePlanned(id, payload) {
  const old = getSession(id);
  if (!old || old.kind !== "planned") {
    const err = new Error("Planificada no encontrada");
    err.status = 404;
    throw err;
  }
  const merged = { ...old, ...payload, id: String(id) };
  upsertSession(getTenantId(), "planned", merged);
  return withObjectives(enrich(merged));
}

export function deletePlanned(id) {
  const old = getSession(id);
  if (!old || old.kind !== "planned") {
    const err = new Error("Planificada no encontrada");
    err.status = 404;
    throw err;
  }
  deleteSession(id);
}
