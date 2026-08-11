import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DB_PATH = `/tmp/opencode/plan-chat-context-${randomUUID()}.db`;

const { getDb } = await import("../lib/db.js");
const { withTenant, upsertSession } = await import("../lib/sessions.js");
const { listPlanned } = await import("../lib/planned.js");
const { buildChatUserPrompt } = await import("../lib/trainer.js");

const tenantId = randomUUID();
const planId = randomUUID();
const plannedId = randomUUID();
const completedId = "garmin-completed-1";
const now = new Date().toISOString();

getDb().prepare(
  "INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)"
).run(tenantId, "Test", `test-${tenantId}`, now);

withTenant(tenantId, () => {
  upsertSession(tenantId, "planned", {
    id: plannedId,
    plan_id: planId,
    sport: "running",
    title: "Carrera Z2",
    name: "Carrera planificada",
    start_date_local: "2026-08-10T08:00:00",
    workout_text: "45 min @ Z2",
    merged_with: completedId,
  });
  upsertSession(tenantId, "completed", {
    id: completedId,
    sport: "running",
    title: "Carrera Z2 realizada",
    name: "Morning Run",
    start_date_local: "2026-08-10T08:12:00",
    moving_time_s: 2700,
    distance_m: 7000,
    avg_heartrate: 138,
    notes: "Me encontré bien; terminé algo más rápido.",
  });
  upsertSession(tenantId, "planned", {
    id: randomUUID(),
    plan_id: planId,
    sport: "cycling",
    title: "Rodaje suave",
    name: "Rodaje suave",
    start_date_local: "2026-08-11T08:00:00",
    workout_text: "60 min suaves",
  });
});

test("el contexto del chat incluye solo actividades realizadas fusionadas y sus notas", () => {
  const prompt = withTenant(tenantId, () => buildChatUserPrompt(planId, "Analiza mi semana"));

  assert.match(prompt, /ACTIVIDADES REALIZADAS DE ESTE PLAN/);
  assert.match(prompt, /Me encontré bien; terminé algo más rápido/);
  assert.match(prompt, /Carrera Z2 realizada/);
  assert.doesNotMatch(prompt, /Rodaje suave/);
});

test("las planificadas fusionadas exponen la actividad completada", () => {
  const planned = withTenant(tenantId, () => listPlanned());
  const merged = planned.find((session) => session.id === plannedId);

  assert.equal(merged.completed_session.id, completedId);
  assert.equal(merged.completed_session.notes, "Me encontré bien; terminé algo más rápido.");
});
