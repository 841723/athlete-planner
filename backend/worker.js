import { getDb } from "./lib/db.js";
import { withTenant } from "./lib/sessions.js";
import { getDefaultAiConfig } from "./lib/ai-configs.js";
import { chatWithCoach } from "./lib/trainer.js";
import { setChatPending, updateChatResponseId, addChatMessage } from "./lib/coach-chat.js";
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

    if (job.type === "coach_chat") {
      const settings = getDefaultAiConfig(job.tenant_id, true);
      if (!settings) throw new Error("La configuración de IA ya no existe");
      const result = await chatWithCoach({
        message: payload.message,
        previousResponseId: payload.previousResponseId ?? null,
        settings,
        actor,
      });
      if (result.responseId) updateChatResponseId(job.tenant_id, result.responseId);
      setChatPending(job.tenant_id, false);
      finishJob(job.id, "completed", { result: { reply: result.reply, profileUpdated: result.profileUpdated } });
      await sendPushToUser(job.tenant_id, job.user_id, {
        title: "El entrenador ha respondido",
        body: "Hay una nueva respuesta en el chat del entrenador.",
        url: job.deep_link ?? `/${job.tenant_id}/trainer`,
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
    if (job.type === "coach_chat") {
      withTenant(job.tenant_id, () => {
        setChatPending(job.tenant_id, false);
        addChatMessage("assistant", "No se pudo completar la respuesta en este momento. Vuelve a preguntar cuando quieras.");
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
