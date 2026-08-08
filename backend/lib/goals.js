import { getDb } from "./db.js";
import { getTenantId } from "./sessions.js";

export function getGoals(tenantId = getTenantId()) {
  if (!tenantId) return [];
  return getDb()
    .prepare("SELECT week, label, date, target_pace, url, is_primary FROM goals WHERE tenant_id = ? ORDER BY week")
    .all(tenantId)
    .map((r) => ({
      week: r.week,
      label: r.label,
      date: r.date,
      targetPace: r.target_pace,
      url: r.url ?? undefined,
      isPrimary: !!r.is_primary,
    }));
}

export function saveGoals(tenantId, goals) {
  const db = getDb();
  db.prepare("DELETE FROM goals WHERE tenant_id = ?").run(tenantId);
  const insert = db.prepare(
    "INSERT INTO goals (tenant_id, week, label, date, target_pace, url, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const list = Array.isArray(goals) ? goals : [];
  let primarySet = false;
  for (const g of list) {
    const isPrimary = !primarySet && !!g?.isPrimary;
    if (isPrimary) primarySet = true;
    insert.run(
      tenantId,
      g?.week ?? null,
      g?.label ?? null,
      g?.date ?? null,
      g?.targetPace ?? null,
      g?.url || null,
      isPrimary ? 1 : 0
    );
  }
}
