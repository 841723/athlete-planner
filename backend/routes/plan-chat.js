import { getPlan, updatePlanResponseId, setChatPending } from "../lib/plans.js";
import { listPlanMessages, addPlanMessage, deletePlanAndSessions } from "../lib/plan-chat.js";
import { chatWithPlan } from "../lib/trainer.js";
import { getAiConfigWithKey, getDefaultAiConfig } from "../lib/ai-configs.js";
import { withTenant } from "../lib/sessions.js";
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

// Procesa la respuesta del entrenador fuera del ciclo de la petición HTTP para
// que la conversación no dependa de que el navegador siga abierto: si el usuario
// recarga o cierra la pestaña mientras la IA responde, el mensaje se persiste
// igualmente y el frontend lo recoge al volver a consultar el chat.
async function runChatReply({ planId, message, previousResponseId, settings, actor, tenantId }) {
  await withTenant(tenantId, async () => {
    try {
      const result = await chatWithPlan({
        planId,
        message,
        previousResponseId,
        settings,
        actor,
      });
      if (result.responseId) updatePlanResponseId(planId, result.responseId);
    } catch (err) {
      console.error("Error al responder en el chat del plan:", err.message);
      addPlanMessage(
        planId,
        "assistant",
        "No se pudo completar la respuesta en este momento. Vuelve a preguntar cuando quieras."
      );
    } finally {
      setChatPending(planId, false);
    }
  });
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
      messages: listPlanMessages(plan.id),
    });
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

    // Respondemos de inmediato para no bloquear la pestaña; la respuesta llega
    // en background y el frontend la muestra cuando vuelve a consultar.
    void runChatReply({
      planId: plan.id,
      message,
      previousResponseId: plan.response_id ?? null,
      settings: config,
      actor: c.actor,
      tenantId: c.tenantId,
    });

    return sendJson(c.res, 200, { pending: true });
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
