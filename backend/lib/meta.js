import { getTenantId, getTenantSettings } from "./sessions.js";

export function getMeta(tenantId = getTenantId()) {
  const settings = getTenantSettings(tenantId);
  return {
    trainingWeekOneStart: settings.training_week_one_start ?? "2026-05-11",
    planStart: settings.plan_start ?? "2026-05-12",
    goalDate: settings.goal_date ?? "2027-04-18",
  };
}
