import { format, parseISO, startOfWeek } from "date-fns";
import { getDb } from "./db.js";
import { getTenantId, getTenantSettings } from "./sessions.js";

const DEFAULT_FOCUS_SPORTS = ["running", "cycling", "swimming"];

export function mondayOfPlanStart(planStart) {
  if (!planStart) return null;
  const start = parseISO(planStart.length === 10 ? `${planStart}T00:00:00` : planStart);
  return format(startOfWeek(start, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getFocusSports(tenantId = getTenantId()) {
  const raw = getTenantSettings(tenantId)?.focus_sports;
  if (!raw) return [...DEFAULT_FOCUS_SPORTS];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* ignorar */
  }
  return [...DEFAULT_FOCUS_SPORTS];
}

export function getMeta(tenantId = getTenantId()) {
  const settings = getTenantSettings(tenantId);
  const planStart = settings.plan_start ?? "2026-05-12";
  return {
    trainingWeekOneStart: settings.training_week_one_start ?? mondayOfPlanStart(planStart) ?? "2026-05-11",
    planStart,
    goalDate: settings.goal_date ?? "2027-04-18",
    minDate: settings.min_date ?? null,
    focusSports: getFocusSports(tenantId),
  };
}

export function saveMeta(tenantId, body = {}) {
  const db = getDb();
  const current = getTenantSettings(tenantId);
  const planStart = body.plan_start ?? current.plan_start ?? null;
  const fields = {
    plan_start: planStart,
    goal_date: body.goal_date ?? current.goal_date ?? null,
    training_week_one_start: mondayOfPlanStart(planStart) ?? current.training_week_one_start ?? null,
    min_date: body.min_date ?? current.min_date ?? null,
  };
  let focusSports = current.focus_sports ?? null;
  if (Array.isArray(body.focus_sports)) {
    const valid = new Set(["running", "cycling", "swimming", "strength"]);
    const sports = [...new Set(body.focus_sports)].filter((s) => valid.has(s));
    focusSports = sports.length > 0 ? JSON.stringify(sports) : null;
  }

  db.prepare(
    `INSERT INTO tenant_settings (tenant_id, plan_start, goal_date, training_week_one_start, min_date, focus_sports)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       plan_start = excluded.plan_start,
       goal_date = excluded.goal_date,
       training_week_one_start = excluded.training_week_one_start,
       min_date = excluded.min_date,
       focus_sports = excluded.focus_sports`
  ).run(
    tenantId,
    fields.plan_start,
    fields.goal_date,
    fields.training_week_one_start,
    fields.min_date,
    focusSports
  );
}
