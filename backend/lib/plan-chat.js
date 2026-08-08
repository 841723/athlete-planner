import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { getTenantId, upsertSession, enrich, deleteSession, loadPlannedSessions } from "./sessions.js";
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

export function deletePlanSessions(planId) {
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  for (const s of planned) deleteSession(s.id);
}

export function deletePlanAndSessions(tenantId, planId) {
  deletePlanMessages(planId);
  deletePlanSessions(planId);
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}

export function replacePlanSessions(planId, rawSessions) {
  deletePlanSessions(planId);
  const created = [];
  for (const raw of rawSessions) {
    if (!raw?.sport || !raw?.start_date_local) continue;
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
