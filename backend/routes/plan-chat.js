import { getPlan, updatePlanResponseId, setChatPending, updatePlanChatInstructions } from "../lib/plans.js";
import { listPlanMessages, addPlanMessage, deletePlanAndSessions } from "../lib/plan-chat.js";
import { getAiConfigWithKey, getDefaultAiConfig } from "../lib/ai-configs.js";
import { createJob } from "../lib/jobs.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

function planConfig(c, plan) {
  if (plan.aiConfigId) return getAiConfigWithKey(c.tenantId, plan.aiConfigId);
  return getDefaultAiConfig(c.tenantId, true);
}

function canChat(plan) {
  return plan.status === "completed";
}

function isGenerating(plan) {
  return plan.status === "pending" || plan.status === "generating";
}

function getPlanOr404(c, planId) {
  const plan = getPlan(c.tenantId, planId);
  if (!plan) sendJson(c.res, 404, { error: "Plan no encontrado" });
  return plan;
}

export function register(router) {
  router.get("/api/plans/:id/chat", (c) => {
    const plan = getPlanOr404(c, c.params.id);
    if (!plan) return;
    return sendJson(c.res, 200, {
      planId: plan.id,
      planCreatedAt: plan.created_at,
      canChat: canChat(plan),
      chatPending: Boolean(plan.chatPending),
      chatInstructions: plan.chatInstructions ?? "",
      messages: listPlanMessages(plan.id),
    });
  });

  router.put("/api/plans/:id/chat/settings", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const plan = getPlanOr404(c, c.params.id);
    if (!plan) return;
    const body = await readBody(c.req);
    const instructions = String(body?.instructions ?? "").trim();
    if (instructions.length > 5000) return sendJson(c.res, 400, { error: "Las instrucciones no pueden superar 5.000 caracteres" });
    updatePlanChatInstructions(c.tenantId, plan.id, instructions);
    return sendJson(c.res, 200, { instructions });
  });

  router.post("/api/plans/:id/chat", async (c) => {
    if (!canWrite(c.membership)) {
      return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    }
    const plan = getPlanOr404(c, c.params.id);
    if (!plan) return;
    if (isGenerating(plan)) {
      return sendJson(c.res, 409, {
        error: "El plan aún se está generando. Prueba de nuevo cuando termine.",
      });
    }
    if (plan.chatPending) {
      return sendJson(c.res, 409, {
        error: "El entrenador aún está escribiendo la respuesta al mensaje anterior.",
      });
    }
    const config = planConfig(c, plan);
    const body = await readBody(c.req);
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return sendJson(c.res, 400, { error: "El mensaje no puede estar vacío" });
    }
    if (!config) {
      return sendJson(c.res, 400, {
        error: "Configura un proveedor de IA en Configuración antes de chatear.",
      });
    }

    // Persist the athlete's message before the provider call so it remains in
    // the thread even if the model times out or returns an invalid response.
    addPlanMessage(plan.id, "user", message);
    setChatPending(plan.id, true);

    const job = createJob({
      tenantId: c.tenantId,
      userId: c.actor?.userId ?? null,
      type: "plan_chat",
      dedupeKey: `plan-chat:${plan.id}`,
      payload: {
        message,
        previousResponseId: plan.response_id ?? null,
        aiConfigId: config.id,
      },
      relatedResourceType: "plan",
      relatedResourceId: plan.id,
      deepLink: `/${c.tenantId}/planned/${plan.id}`,
    });

    return sendJson(c.res, 202, { pending: true, jobId: job.id });
  });

  router.post("/api/plans/:id/chat/cancel", (c) => {
    if (!canWrite(c.membership)) {
      return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    }
    const plan = getPlanOr404(c, c.params.id);
    if (!plan) return;
    if (isGenerating(plan)) {
      return sendJson(c.res, 409, {
        error: "El plan aún se está generando. No se puede cancelar la respuesta.",
      });
    }
    // Libera el bloqueo del chat y descarta el hilo anterior para que el
    // próximo mensaje arranque con contexto completo (sin quedar colgado del
    // hilo que no respondió). El propio entrenador, si la llamada IA aún sigue
    // en vuelo, añadirá su respuesta al final sin volver a bloquear.
    setChatPending(plan.id, false);
    updatePlanResponseId(plan.id, null);
    return sendJson(c.res, 200, { cancelled: true });
  });

  router.delete("/api/plans/:id/chat", (c) => {
    if (!canWrite(c.membership)) {
      return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    }
    const plan = getPlanOr404(c, c.params.id);
    if (!plan) return;
    deletePlanAndSessions(c.tenantId, plan.id);
    c.res.writeHead(204);
    return c.res.end();
  });
}
