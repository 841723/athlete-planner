import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { enrich, getMergedCompletedSession } from "./sessions.js";

export const PLAN_STATES = ["pending", "generating", "completed", "failed"];

const STALE_MS = 10 * 60 * 1000;

const PLAN_COLUMNS = `id, created_at, comments, weeks, response_id,
              context_hash AS contextHash,
              profile_version_id AS profileVersionId,
              prompt_id AS promptId,
              prompt_name AS promptName,
              ai_config_id AS aiConfigId,
              status, error,
              request_comments AS requestComments,
              started_at AS startedAt,
              finished_at AS finishedAt,
              chat_pending AS chatPending,
              active,
              chat_instructions AS chatInstructions`;

export function savePlan(tenantId, { comments, weeks, aiConfigId = null, promptId, promptName, responseId = null, status = "completed", requestComments = null, active = false }) {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO plans (id, tenant_id, created_at, comments, weeks, prompt_id, prompt_name, ai_config_id, response_id, status, request_comments, started_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      new Date().toISOString(),
      active ? 1 : 0,
    );
  return id;
}

export function activatePlan(tenantId, planId) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const exists = db.prepare("SELECT id FROM plans WHERE tenant_id = ? AND id = ?").get(tenantId, planId);
    if (!exists) throw new Error("Plan no encontrado");
    db.prepare("UPDATE plans SET active = 0 WHERE tenant_id = ?").run(tenantId);
    db.prepare("UPDATE plans SET active = 1 WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw error;
  }
}

export function getActivePlan(tenantId) {
  recoverStalePlans(tenantId);
  recoverStaleChat(tenantId);
  const db = getDb();
  let row = db.prepare(`SELECT ${PLAN_COLUMNS} FROM plans WHERE tenant_id = ? AND active = 1 LIMIT 1`).get(tenantId);
  if (!row) {
    row = db.prepare(`SELECT ${PLAN_COLUMNS} FROM plans WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(tenantId);
    if (row) activatePlan(tenantId, row.id);
  }
  return row ? { ...row, active: true, ...getPlanProgress(tenantId, row.id) } : null;
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

export function updatePlanRequest(planId, { weeks, aiConfigId, promptId, promptName, requestComments }) {
  getDb().prepare(
    "UPDATE plans SET weeks = ?, ai_config_id = ?, prompt_id = ?, prompt_name = ?, request_comments = ?, error = NULL WHERE id = ?"
  ).run(weeks, aiConfigId ?? null, promptId ?? null, promptName ?? null, requestComments ?? "", planId);
}

export function updatePlanChatInstructions(tenantId, planId, instructions) {
  return getDb().prepare(
    "UPDATE plans SET chat_instructions = ? WHERE tenant_id = ? AND id = ?"
  ).run(instructions?.trim() || null, tenantId, planId).changes > 0;
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

export function updatePlanContextHash(planId, contextHash) {
  getDb()
    .prepare("UPDATE plans SET context_hash = ? WHERE id = ?")
    .run(contextHash ?? null, planId);
}

export function setChatPending(planId, pending) {
  getDb()
    .prepare("UPDATE plans SET chat_pending = ? WHERE id = ?")
    .run(pending ? 1 : 0, planId);
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

// Libera chats que quedaron atascados en "escribiendo" (chat_pending = 1): el
// servidor pudo reiniciarse a mitad de la llamada IA o el proveedor no
// respondió. Se considera atascado si el último mensaje del atleta es antiguo.
export function recoverStaleChat(tenantId) {
  const rows = getDb()
    .prepare("SELECT id FROM plans WHERE tenant_id = ? AND chat_pending = 1")
    .all(tenantId);
  if (!rows.length) return 0;
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  let recovered = 0;
  for (const row of rows) {
    const last = getDb()
      .prepare(
        "SELECT created_at FROM plan_messages WHERE plan_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1"
      )
      .get(row.id);
    const lastAt = last?.created_at;
    if (!lastAt || lastAt < cutoff) {
      setChatPending(row.id, false);
      updatePlanResponseId(row.id, null);
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

export function getPlanProgress(tenantId, planId) {
  const rows = getDb()
    .prepare(
      "SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'planned' AND json_extract(data, '$.plan_id') = ?"
    )
    .all(tenantId, planId);
  let completedSessions = 0;
  for (const row of rows) {
    let session;
    try {
      session = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (getMergedCompletedSession(session, tenantId)) completedSessions++;
  }
  return {
    totalSessions: rows.length,
    completedSessions,
    trainingCompleted: rows.length > 0 && completedSessions === rows.length,
  };
}

export function listPlans(tenantId) {
  const active = getActivePlan(tenantId);
  return active ? [active] : [];
}

export function getPlan(tenantId, planId) {
  recoverStaleChat(tenantId);
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
  const progress = getPlanProgress(tenantId, planId);
  const plannedSessions = getDb().prepare(
    "SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'planned' AND json_extract(data, '$.plan_id') = ? ORDER BY start_date_local"
  ).all(tenantId, planId).map((row) => {
    const session = enrich(JSON.parse(row.data));
    return { ...session, completed_session: getMergedCompletedSession(session, tenantId) };
  });
  return { ...plan, ...progress, plannedSessions };
}

export function deletePlan(tenantId, planId) {
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}
