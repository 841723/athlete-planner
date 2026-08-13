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
  toLocalDateKey,
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

// Borra sesiones planificadas de un plan. Por defecto conserva las fusionadas
// con actividad real (preserveCompleted). Con futureOnly solo elimina las que
// aún no han llegado (fecha de hoy en adelante), dejando intactas las sesiones
// pasadas aunque no se hayan realizado: el pasado del plan es inmutable.
export function deletePlanSessions(planId, { preserveCompleted = true, futureOnly = false } = {}) {
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  const todayKey = toLocalDateKey(new Date());
  for (const s of planned) {
    if (preserveCompleted && s.merged_with) continue;
    if (futureOnly && (s.start_date_local ?? "").slice(0, 10) < todayKey) continue;
    deleteSession(s.id);
  }
}

export function deletePlanAndSessions(tenantId, planId) {
  deletePlanMessages(planId);
  deletePlanSessions(planId, { preserveCompleted: false });
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}

export function replacePlanSessions(planId, rawSessions) {
  // Solo se reemplaza la parte futura del plan. Las planificadas pasadas (hayan
  // sido realizadas o no) se conservan intactas: el chat nunca las modifica.
  deletePlanSessions(planId, { futureOnly: true });

  const completed = loadCompletedSessions();
  const todayKey = toLocalDateKey(new Date());

  const created = [];
  for (const raw of rawSessions) {
    if (!raw?.sport || !raw?.start_date_local) continue;
    const date = String(raw.start_date_local).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayKey) continue;

    // No se vuelve a planificar una sesión cuya actividad ya se realizó ese
    // día y categoría de deporte: impedir que reaparezcan en el calendario.
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
