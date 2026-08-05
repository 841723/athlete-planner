import { getDb } from "./db.js";
import { getTenantId } from "./sessions.js";

export function getGoals(tenantId = getTenantId()) {
  if (!tenantId) return [];
  return getDb()
    .prepare("SELECT week, label, date, target_pace FROM goals WHERE tenant_id = ? ORDER BY week")
    .all(tenantId)
    .map((r) => ({
      week: r.week,
      label: r.label,
      date: r.date,
      targetPace: r.target_pace,
    }));
}

export function saveGoals(tenantId, goals) {
  const db = getDb();
  db.prepare("DELETE FROM goals WHERE tenant_id = ?").run(tenantId);
  const insert = db.prepare(
    "INSERT INTO goals (tenant_id, week, label, date, target_pace) VALUES (?, ?, ?, ?, ?)"
  );
  for (const g of goals ?? []) {
    insert.run(tenantId, g.week ?? null, g.label ?? null, g.date ?? null, g.targetPace ?? null);
  }
}
