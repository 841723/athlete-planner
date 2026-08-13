import { getDb } from "./lib/db.js";
import { withTenant } from "./lib/sessions.js";
import { getAiConfigWithKey } from "./lib/ai-configs.js";
import { chatWithPlan, generatePlan } from "./lib/trainer.js";
import { getPlan, setChatPending, updatePlanResponseId, updatePlanStatus } from "./lib/plans.js";
import { addPlanMessage } from "./lib/plan-chat.js";
import { runSync } from "./lib/sync.js";
import { sendPushToUser } from "./lib/push.js";
import { claimNextJob, createJob, finishJob, heartbeatJob } from "./lib/jobs.js";

let started = false;
let timer = null;
let automaticSyncAt = 0;

function actorFor(job) {
  return {
    tenantId: job.tenant_id,
    userId: job.user_id ?? null,
    authMethod: "job",
    display: job.user_id ? `user:${job.user_id}` : "automatic",
  };
}

async function processJob(job) {
  const payload = job.payload ?? {};
  const actor = actorFor(job);
  return withTenant(job.tenant_id, async () => {
    heartbeatJob(job.id);
    if (job.type === "sync") {
      const result = await runSync({ force: payload.force === true });
      finishJob(job.id, "completed", { result });
      if ((result.synced ?? result.newActivities ?? 0) > 0) {
        await sendPushToUser(job.tenant_id, job.user_id, {
          title: "Sincronización completada",
          body: `${result.synced ?? result.newActivities} actividades nuevas`,
          url: job.deep_link ?? `/${job.tenant_id}/calendar`,
        });
      }
      return;
    }

    if (job.type === "plan_generation") {
      const settings = getAiConfigWithKey(job.tenant_id, payload.aiConfigId);
      if (!settings) throw new Error("La configuración de IA ya no existe");
      const result = await generatePlan({
        ...payload,
        settings,
        actor,
        planId: job.related_resource_id,
      });
      finishJob(job.id, "completed", { result });
      await sendPushToUser(job.tenant_id, job.user_id, {
        title: "Tu nuevo plan de entrenamiento está listo",
        body: "Puedes revisar las sesiones y hablar con el entrenador.",
        url: job.deep_link ?? `/${job.tenant_id}/planned/${result.planId}`,
      });
      return;
    }

    if (job.type === "plan_chat") {
      const plan = getPlan(job.tenant_id, job.related_resource_id);
      if (!plan) throw new Error("Plan no encontrado");
      const settings = getAiConfigWithKey(job.tenant_id, payload.aiConfigId);
      if (!settings) throw new Error("La configuración de IA ya no existe");
      const result = await chatWithPlan({
        planId: plan.id,
        message: payload.message,
        previousResponseId: payload.previousResponseId ?? null,
        settings,
        actor,
      });
      if (result.responseId) updatePlanResponseId(plan.id, result.responseId);
      setChatPending(plan.id, false);
      finishJob(job.id, "completed", { result: { reply: result.reply, profileUpdated: result.profileUpdated } });
      await sendPushToUser(job.tenant_id, job.user_id, {
        title: "El entrenador ha respondido",
        body: "Hay una nueva respuesta en el chat del plan.",
        url: job.deep_link ?? `/${job.tenant_id}/planned/${plan.id}`,
      });
      return;
    }

    throw new Error(`Tipo de job desconocido: ${job.type}`);
  });
}

async function tick() {
  if (Date.now() >= automaticSyncAt) {
    automaticSyncAt = Date.now() + 5 * 60 * 1000;
    const rows = getDb().prepare(
      "SELECT tenant_id FROM sync_sources WHERE provider = 'garmin' AND status = 'connected' AND tokens IS NOT NULL"
    ).all();
    for (const row of rows) {
      try {
        createJob({ tenantId: row.tenant_id, type: "sync", dedupeKey: "sync:garmin", payload: { automatic: true }, deepLink: `/${row.tenant_id}/calendar` });
      } catch (error) {
        if (error?.status !== 409) console.error("No se pudo programar sync automática:", error.message);
      }
    }
  }

  const job = claimNextJob();
  if (!job) return;
  const heartbeat = setInterval(() => heartbeatJob(job.id), 30_000);
  try {
    await processJob(job);
  } catch (error) {
    finishJob(job.id, "failed", { error: error?.message ?? String(error) });
    if (job.type === "plan_generation" && job.related_resource_id) {
      withTenant(job.tenant_id, () => updatePlanStatus(job.related_resource_id, "failed", error?.message ?? String(error)));
    }
    if (job.type === "plan_chat" && job.related_resource_id) {
      withTenant(job.tenant_id, () => {
        setChatPending(job.related_resource_id, false);
        addPlanMessage(job.related_resource_id, "assistant", "No se pudo completar la respuesta en este momento. Vuelve a preguntar cuando quieras.");
      });
    }
  } finally {
    clearInterval(heartbeat);
  }
}

export function startWorker({ intervalMs = 1000 } = {}) {
  if (started) return;
  started = true;
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  startWorker();
  console.log("Background worker iniciado");
}
