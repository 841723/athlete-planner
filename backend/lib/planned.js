import { randomUUID } from "node:crypto";
import { getTenantId, loadPlannedSessions, enrich, getMergedCompletedSession, getSession, updateSession, deleteSession, upsertSession } from "./sessions.js";
import { buildObjectives } from "./objectives.js";

const LEGACY_KEYS = [
  "workout",
  "hr_from",
  "hr_to",
  "distance_m",
  "moving_time_s",
  "elapsed_time_s",
  "avg_pace_s_per_km",
  "avg_speed_ms",
];

function stripLegacy(session) {
  for (const k of LEGACY_KEYS) delete session[k];
  return session;
}

function withObjectives(session) {
  if (!session) return null;
  return {
    ...session,
    objectives: buildObjectives(session),
    completed_session: getMergedCompletedSession(session),
  };
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
  const session = stripLegacy({
    ...payload,
    schema_version: 2,
    id: randomUUID(),
  });
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
  const merged = stripLegacy({ ...old, ...payload, id: String(id) });
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
