import { getPlan, updatePlanResponseId } from "../lib/plans.js";
import { listPlanMessages, addPlanMessage, deletePlanAndSessions } from "../lib/plan-chat.js";
import { chatWithPlan } from "../lib/trainer.js";
import { getAiConfigWithKey, getDefaultAiConfig } from "../lib/ai-configs.js";
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

    const result = await chatWithPlan({
      planId: plan.id,
      message,
      previousResponseId: plan.response_id ?? null,
      settings: config,
      actor: c.actor,
    });

    if (result.responseId) updatePlanResponseId(plan.id, result.responseId);

    return sendJson(c.res, 200, {
      reply: result.reply,
      sessionsUpdated: result.sessionsUpdated.length,
      responseId: result.responseId ?? null,
    });
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
