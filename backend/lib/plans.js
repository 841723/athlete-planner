import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export function savePlan(tenantId, { comments, weeks, profileVersionId, promptId, promptName, responseId = null }) {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO plans (id, tenant_id, created_at, comments, weeks, profile_version_id, prompt_id, prompt_name, response_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      id,
      tenantId,
      new Date().toISOString(),
      comments ?? "",
      weeks ?? 1,
      profileVersionId ?? null,
      promptId ?? null,
      promptName ?? null,
      responseId
    );
  return id;
}

export function updatePlanResponseId(planId, responseId) {
  getDb()
    .prepare("UPDATE plans SET response_id = ? WHERE id = ?")
    .run(responseId ?? null, planId);
}

export function listPlans(tenantId) {
  return getDb()
    .prepare(
      `SELECT id, created_at, comments, weeks, response_id,
              profile_version_id AS profileVersionId,
              prompt_id AS promptId,
              prompt_name AS promptName
       FROM plans WHERE tenant_id = ? ORDER BY created_at DESC`
    )
    .all(tenantId);
}

export function getPlan(tenantId, planId) {
  return (
    getDb()
      .prepare(
        `SELECT id, created_at, comments, weeks, response_id,
                profile_version_id AS profileVersionId,
                prompt_id AS promptId,
                prompt_name AS promptName
         FROM plans WHERE tenant_id = ? AND id = ?`
      )
      .get(tenantId, planId) ?? null
  );
}

export function deletePlan(tenantId, planId) {
  getDb().prepare("DELETE FROM plans WHERE tenant_id = ? AND id = ?").run(tenantId, planId);
}
