import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { enrich, getMergedCompletedSession } from "./sessions.js";

export const PLAN_STATES = ["pending", "generating", "completed", "failed"];

const STALE_MS = 10 * 60 * 1000;

const PLAN_COLUMNS = `id, created_at, comments, weeks, response_id,
              profile_version_id AS profileVersionId,
              prompt_id AS promptId,
              prompt_name AS promptName,
              ai_config_id AS aiConfigId,
              status, error,
              request_comments AS requestComments,
              started_at AS startedAt,
              finished_at AS finishedAt`;

export function savePlan(tenantId, { comments, weeks, aiConfigId = null, promptId, promptName, responseId = null, status = "completed", requestComments = null }) {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO plans (id, tenant_id, created_at, comments, weeks, prompt_id, prompt_name, ai_config_id, response_id, status, request_comments, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      tenantId,
      new Date().toISOString(),
      comments ?? "",
      weeks ?? 1,
      promptId ?? null,
      promptName ?? null,
      aiConfigId ?? null,
      responseId,
      status,
      requestComments,
      new Date().toISOString()
    );
  return id;
}

export function updatePlanStatus(planId, status, error = null) {
  if (!PLAN_STATES.includes(status)) throw new Error(`Estado de plan inválido: ${status}`);
  const now = new Date().toISOString();
  if (status === "completed" || status === "failed") {
    getDb()
      .prepare("UPDATE plans SET status = ?, error = ?, finished_at = ? WHERE id = ?")
      .run(status, error, now, planId);
  } else {
    getDb()
      .prepare("UPDATE plans SET status = ?, error = ? WHERE id = ?")
      .run(status, error, planId);
  }
}

export function updatePlanResult(planId, { comments, responseId }) {
  getDb()
    .prepare(
      "UPDATE plans SET comments = ?, response_id = ?, status = 'completed', error = NULL, finished_at = ? WHERE id = ?"
    )
    .run(comments ?? "", responseId ?? null, new Date().toISOString(), planId);
}

export function updatePlanResponseId(planId, responseId) {
  getDb()
    .prepare("UPDATE plans SET response_id = ? WHERE id = ?")
    .run(responseId ?? null, planId);
}

export function recoverStalePlans(tenantId) {
  const rows = getDb()
    .prepare(
      "SELECT id, started_at FROM plans WHERE tenant_id = ? AND status IN ('pending', 'generating')"
    )
    .all(tenantId);
  let recovered = 0;
  for (const row of rows) {
    if (row.started_at && Date.now() - new Date(row.started_at).getTime() > STALE_MS) {
      updatePlanStatus(row.id, "failed", "La generación se interrumpió. Puedes reintentarla.");
      recovered++;
    }
  }
  return recovered;
}

export function hasActiveGeneration(tenantId) {
  recoverStalePlans(tenantId);
  return !!getDb()
    .prepare("SELECT 1 FROM plans WHERE tenant_id = ? AND status IN ('pending', 'generating')")
    .get(tenantId);
}

export function listPlans(tenantId) {
  recoverStalePlans(tenantId);
  return getDb()
    .prepare(
      `SELECT ${PLAN_COLUMNS}
       FROM plans WHERE tenant_id = ? ORDER BY created_at DESC`
    )
    .all(tenantId);
}

export function getPlan(tenantId, planId) {
  return (
    getDb()
      .prepare(
        `SELECT ${PLAN_COLUMNS}
         FROM plans WHERE tenant_id = ? AND id = ?`
      )
      .get(tenantId, planId) ?? null
  );
}

export function getPlanDto(tenantId, planId) {
  const plan = getPlan(tenantId, planId);
  if (!plan) return null;
  const plannedSessions = getDb().prepare(
    "SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'planned' AND json_extract(data, '$.plan_id') = ? ORDER BY start_date_local"
  ).all(tenantId, planId).map((row) => {
    const session = enrich(JSON.parse(row.data));
    return { ...session, completed_session: getMergedCompletedSession(session, tenantId) };
  });
  return { ...plan, plannedSessions };
}

export function deletePlan(tenantId, planId) {
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}
