import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import {
  getTenantId,
  upsertSession,
  enrich,
  deleteSession,
  loadPlannedSessions,
  loadCompletedSessions,
  getSportCategory,
} from "./sessions.js";
import { buildObjectives } from "./objectives.js";

export function listPlanMessages(planId) {
  return getDb()
    .prepare(
      "SELECT id, plan_id, role, content, created_at FROM plan_messages WHERE plan_id = ? ORDER BY created_at"
    )
    .all(planId);
}

export function addPlanMessage(planId, role, content) {
  getDb()
    .prepare(
      "INSERT INTO plan_messages (id, plan_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(randomUUID(), planId, role, content, new Date().toISOString());
}

export function deletePlanMessages(planId) {
  getDb().prepare("DELETE FROM plan_messages WHERE plan_id = ?").run(planId);
}

export function deletePlanSessions(planId, { preserveCompleted = true } = {}) {
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  for (const s of planned) {
    if (preserveCompleted && s.merged_with) continue;
    deleteSession(s.id);
  }
}

export function deletePlanAndSessions(tenantId, planId) {
  deletePlanMessages(planId);
  deletePlanSessions(planId, { preserveCompleted: false });
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}

export function replacePlanSessions(planId, rawSessions) {
  deletePlanSessions(planId);

  const completed = loadCompletedSessions();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const created = [];
  for (const raw of rawSessions) {
    if (!raw?.sport || !raw?.start_date_local) continue;

    // Nunca se crean sesiones en el pasado: el plan solo se modifica hacia
    // delante. Las sesiones pasadas ya realizadas se conservan por separado.
    const start = new Date(raw.start_date_local);
    if (Number.isNaN(start.getTime()) || start < today) continue;

    // No se vuelve a planificar una sesión cuya actividad ya se realizó ese
    // día y categoría de deporte: impedir que reaparezcan en el calendario.
    const date = raw.start_date_local.slice(0, 10);
    const cat = getSportCategory(raw.sport);
    const alreadyDone = completed.some(
      (c) =>
        (c.start_date_local ?? "").slice(0, 10) === date &&
        getSportCategory(c.sport) === cat
    );
    if (alreadyDone) continue;

    const session = {
      schema_version: 2,
      id: randomUUID(),
      plan_id: planId,
      sport: raw.sport,
      title: raw.title,
      name: raw.name ?? raw.title,
      start_date_local: raw.start_date_local,
      workout_text: raw.workout_text,
    };
    upsertSession(getTenantId(), "planned", session);
    created.push({ ...enrich(session), objectives: buildObjectives(session) });
  }
  return created;
}
