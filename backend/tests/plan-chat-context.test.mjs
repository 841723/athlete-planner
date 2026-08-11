import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DB_PATH = `/tmp/opencode/plan-chat-context-${randomUUID()}.db`;

const { getDb } = await import("../lib/db.js");
const { withTenant, upsertSession } = await import("../lib/sessions.js");
const { listPlanned } = await import("../lib/planned.js");
const { buildChatUserPrompt, getRecentSessions } = await import("../lib/trainer.js");
const { replacePlanSessions } = await import("../lib/plan-chat.js");
const { getPlanProgress } = await import("../lib/plans.js");

const tenantId = randomUUID();
const planId = randomUUID();
const plannedId = randomUUID();
const completedId = "garmin-completed-1";
const completePlanId = randomUUID();
const completePlannedId = randomUUID();
const completeCompletedId = "garmin-completed-2";
const now = new Date().toISOString();
const dateAt = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 19);
};

getDb().prepare(
  "INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)"
).run(tenantId, "Test", `test-${tenantId}`, now);
getDb().prepare(
  "INSERT INTO plans (id, tenant_id, created_at, comments, weeks, status) VALUES (?, ?, ?, ?, ?, ?)"
).run(planId, tenantId, now, "", 1, "completed");
getDb().prepare(
  "INSERT INTO plans (id, tenant_id, created_at, comments, weeks, status) VALUES (?, ?, ?, ?, ?, ?)"
).run(completePlanId, tenantId, now, "", 1, "completed");

withTenant(tenantId, () => {
  upsertSession(tenantId, "planned", {
    id: plannedId,
    plan_id: planId,
    sport: "running",
    title: "Carrera Z2",
    name: "Carrera planificada",
    start_date_local: `${dateAt(-1).slice(0, 10)}T08:00:00`,
    workout_text: "45 min @ Z2",
    merged_with: completedId,
  });
  upsertSession(tenantId, "completed", {
    id: completedId,
    sport: "running",
    title: "Carrera Z2 realizada",
    name: "Morning Run",
    start_date_local: `${dateAt(-1).slice(0, 10)}T08:12:00`,
    moving_time_s: 2700,
    distance_m: 7000,
    avg_heartrate: 138,
    notes: "Me encontré bien; terminé algo más rápido.",
  });
  upsertSession(tenantId, "completed", {
    id: "other-completed-1",
    sport: "swimming",
    name: "Natación real anterior",
    start_date_local: `${dateAt(-2).slice(0, 10)}T07:00:00`,
    moving_time_s: 1800,
    notes: "Actividad real fuera de este plan.",
  });
  upsertSession(tenantId, "completed", {
    id: "older-completed-1",
    sport: "cycling",
    name: "Actividad antigua",
    start_date_local: `${dateAt(-35).slice(0, 10)}T07:00:00`,
    moving_time_s: 3600,
  });
  upsertSession(tenantId, "planned", {
    id: randomUUID(),
    plan_id: planId,
    sport: "cycling",
    title: "Rodaje suave",
    name: "Rodaje suave",
      start_date_local: `${dateAt(0).slice(0, 10)}T08:00:00`,
    workout_text: "60 min suaves",
  });
  upsertSession(tenantId, "planned", {
    id: completePlannedId,
    plan_id: completePlanId,
    sport: "running",
    title: "Plan completado",
    start_date_local: `${dateAt(-3).slice(0, 10)}T08:00:00`,
    merged_with: completeCompletedId,
  });
  upsertSession(tenantId, "completed", {
    id: completeCompletedId,
    sport: "running",
    name: "Actividad completada",
    start_date_local: `${dateAt(-3).slice(0, 10)}T08:05:00`,
  });
});

test("el contexto del chat incluye solo actividades realizadas fusionadas y sus notas", () => {
  const prompt = withTenant(tenantId, () => buildChatUserPrompt(planId, "Analiza mi semana"));

  assert.match(prompt, /ACTIVIDADES REALIZADAS DE ESTE PLAN/);
  assert.match(prompt, /Me encontré bien; terminé algo más rápido/);
  assert.match(prompt, /Carrera Z2 realizada/);
  assert.match(prompt, /Actividad real fuera de este plan/);
  assert.doesNotMatch(prompt, /60 min suaves/);
});

test("las planificadas fusionadas exponen la actividad completada", () => {
  const planned = withTenant(tenantId, () => listPlanned());
  const merged = planned.find((session) => session.id === plannedId);

  assert.equal(merged.completed_session.id, completedId);
  assert.equal(merged.completed_session.notes, "Me encontré bien; terminé algo más rápido.");
});

test("un plan parcialmente realizado no se marca como completado", () => {
  const progress = getPlanProgress(tenantId, planId);
  assert.deepEqual(progress, { totalSessions: 2, completedSessions: 1, trainingCompleted: false });
});

test("un plan con todas sus sesiones realizadas se marca como completado", () => {
  const progress = getPlanProgress(tenantId, completePlanId);
  assert.deepEqual(progress, { totalSessions: 1, completedSessions: 1, trainingCompleted: true });
});

test("el feedback del chat no borra planificadas ya realizadas", () => {
  withTenant(tenantId, () => replacePlanSessions(planId, [
    {
      sport: "running",
      title: "Nueva sesión futura",
      start_date_local: `${dateAt(1).slice(0, 10)}T08:00:00`,
      workout_text: "30 min suaves",
    },
  ]));
  const planned = withTenant(tenantId, () => listPlanned());
  assert.ok(planned.some((session) => session.id === plannedId));
  assert.ok(planned.some((session) => session.title === "Nueva sesión futura"));
});

test("la ventana de sesiones recientes para generar planes es configurable y permite cuatro semanas", () => {
  const recent = withTenant(tenantId, () => getRecentSessions(4));
  assert.ok(recent.some((session) => session.id === completedId));
  assert.ok(!recent.some((session) => session.id === "older-completed-1"));
});
