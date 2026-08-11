import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DB_PATH = `/tmp/opencode/plan-chat-context-${randomUUID()}.db`;

const { getDb } = await import("../lib/db.js");
const { withTenant, upsertSession } = await import("../lib/sessions.js");
const { listPlanned } = await import("../lib/planned.js");
const { buildChatUserPrompt, getRecentSessions, computeContextHash } = await import("../lib/trainer.js");
const { getRolePrompt } = await import("../lib/ai-prompts.js");
const { replacePlanSessions } = await import("../lib/plan-chat.js");
const { getPlanProgress, setChatPending, recoverStaleChat, getPlan } = await import("../lib/plans.js");

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

test("el contexto del chat incluye solo actividades de las últimas 4 semanas y sus notas", () => {
  const prompt = withTenant(tenantId, () => buildChatUserPrompt(planId, "Analiza mi semana"));

  assert.match(prompt, /ACTIVIDADES REALIZADAS — ÚLTIMAS 4 SEMANAS/);
  assert.match(prompt, /Me encontré bien; terminé algo más rápido/);
  assert.match(prompt, /Carrera Z2 realizada/);
  assert.match(prompt, /Actividad real fuera de este plan/);
  const completedSection = prompt.split("ACTIVIDADES REALIZADAS — ÚLTIMAS 4 SEMANAS")[1].split("MENSAJE DEL ATLETA")[0];
  assert.doesNotMatch(completedSection, /60 min suaves/);
  assert.doesNotMatch(completedSection, /Actividad antigua/);
});

test("el contexto del chat marca las planificadas realizadas como completadas", () => {
  const prompt = withTenant(tenantId, () => buildChatUserPrompt(planId, "Analiza mi semana"));
  assert.match(prompt, /\[COMPLETADA\]/);
  assert.match(prompt, /\[PENDIENTE\]/);
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

test("el feedback del chat no crea sesiones en fechas pasadas", () => {
  withTenant(tenantId, () => replacePlanSessions(planId, [
    {
      sport: "running",
      title: "Sesión en el pasado",
      start_date_local: `${dateAt(-2).slice(0, 10)}T08:00:00`,
      workout_text: "No debería crearse",
    },
    {
      sport: "running",
      title: "Sesión de hoy",
      start_date_local: `${dateAt(0).slice(0, 10)}T08:00:00`,
      workout_text: "Sí debería crearse",
    },
  ]));
  const planned = withTenant(tenantId, () => listPlanned());
  assert.ok(!planned.some((session) => session.title === "Sesión en el pasado"));
  assert.ok(planned.some((session) => session.title === "Sesión de hoy"));
});

test("el feedback del chat no re-planifica una actividad ya realizada el mismo día", () => {
  const today = dateAt(0).slice(0, 10);
  withTenant(tenantId, () => upsertSession(tenantId, "completed", {
    id: "garmin-today-running",
    sport: "running",
    name: "Rodaje de hoy realizado",
    start_date_local: `${today}T07:00:00`,
    moving_time_s: 1800,
  }));
  withTenant(tenantId, () => replacePlanSessions(planId, [
    {
      sport: "running",
      title: "Rodaje duplicado de hoy",
      start_date_local: `${today}T18:00:00`,
      workout_text: "No debería aparecer en calendario",
    },
  ]));
  const planned = withTenant(tenantId, () => listPlanned());
  assert.ok(!planned.some((session) => session.title === "Rodaje duplicado de hoy"));
});

test("el hash de contexto cambia cuando se registra una actividad nueva", () => {
  const before = withTenant(tenantId, () => computeContextHash(planId));
  const newId = "garmin-hash-change";
  withTenant(tenantId, () => upsertSession(tenantId, "completed", {
    id: newId,
    sport: "running",
    name: "Nueva actividad reciente",
    start_date_local: `${dateAt(0).slice(0, 10)}T07:30:00`,
    moving_time_s: 1800,
  }));
  const after = withTenant(tenantId, () => computeContextHash(planId));
  assert.notEqual(before, after);
});

test("el prompt de chat de un tenant existente se refresca con el seed actual", () => {
  getDb()
    .prepare("UPDATE ai_prompts SET content = ? WHERE tenant_id = ? AND role = 'chat'")
    .run("contenido obsoleto del chat", tenantId);
  const refreshed = withTenant(tenantId, () => getRolePrompt(tenantId, "chat"));
  assert.notEqual(refreshed.content, "contenido obsoleto del chat");
  assert.match(refreshed.content, /NUNCA modifiques, elimines ni vuelvas a incluir sesiones planificadas en fechas pasadas/);
});

test("la ventana de sesiones recientes para generar planes es configurable y permite cuatro semanas", () => {
  const recent = withTenant(tenantId, () => getRecentSessions(4));
  assert.ok(recent.some((session) => session.id === completedId));
  assert.ok(!recent.some((session) => session.id === "older-completed-1"));
});

test("recoverStaleChat libera un chat atascado con mensaje antiguo", () => {
  withTenant(tenantId, () => setChatPending(planId, true));
  getDb()
    .prepare("INSERT INTO plan_messages (id, plan_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)")
    .run(randomUUID(), planId, "mensaje antiguo", new Date(Date.now() - 11 * 60 * 1000).toISOString());
  const recovered = withTenant(tenantId, () => recoverStaleChat(tenantId));
  assert.equal(recovered, 1);
  assert.equal(withTenant(tenantId, () => getPlan(tenantId, planId).chatPending), 0);
});

test("recoverStaleChat no libera un chat con mensaje reciente", () => {
  withTenant(tenantId, () => setChatPending(planId, true));
  getDb()
    .prepare("INSERT INTO plan_messages (id, plan_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)")
    .run(randomUUID(), planId, "mensaje reciente", new Date().toISOString());
  const recovered = withTenant(tenantId, () => recoverStaleChat(tenantId));
  assert.equal(recovered, 0);
  assert.equal(withTenant(tenantId, () => getPlan(tenantId, planId).chatPending), 1);
});
