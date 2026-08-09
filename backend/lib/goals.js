import { getDb } from "./db.js";
import { getTenantId, getTenantSettings } from "./sessions.js";
import { getWeekNumber } from "./sessions.js";

export function getGoals(tenantId = getTenantId()) {
  if (!tenantId) return [];
  return getDb()
    .prepare(
      "SELECT week, label, date, target_pace, url, color, is_primary FROM goals WHERE tenant_id = ? ORDER BY week"
    )
    .all(tenantId)
    .map((r) => ({
      week: r.week,
      label: r.label,
      date: r.date,
      targetPace: r.target_pace,
      url: r.url ?? undefined,
      color: r.color ?? undefined,
      isPrimary: !!r.is_primary,
    }));
}

export function saveGoals(tenantId, goals) {
  const db = getDb();
  db.prepare("DELETE FROM goals WHERE tenant_id = ?").run(tenantId);
  const insert = db.prepare(
    "INSERT INTO goals (tenant_id, week, label, date, target_pace, url, color, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const list = Array.isArray(goals) ? goals : [];
  let primarySet = false;
  for (const g of list) {
    const isPrimary = !primarySet && !!g?.isPrimary;
    if (isPrimary) primarySet = true;
    const week = computeGoalWeek(tenantId, g?.date, g?.week);
    insert.run(
      tenantId,
      week,
      g?.label ?? null,
      g?.date ?? null,
      g?.targetPace ?? null,
      g?.url || null,
      isPrimary ? g?.color || null : null,
      isPrimary ? 1 : 0
    );
  }
}

// La semana del objetivo se calcula desde la fecha del evento y la semana #1
// del plan (training_week_one_start). Si no hay fecha, se usa la semana manual.
function computeGoalWeek(tenantId, date, fallbackWeek) {
  if (!date) return fallbackWeek ?? null;
  try {
    const settings = getTenantSettings(tenantId);
    const weekOneStart = settings.training_week_one_start ?? "2026-05-11";
    return getWeekNumber(new Date(`${date}T00:00:00`), weekOneStart);
  } catch {
    return fallbackWeek ?? null;
  }
}
