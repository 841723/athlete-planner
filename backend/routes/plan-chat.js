import { getPlan, updatePlanResponseId } from "../lib/plans.js";
import { listPlanMessages, addPlanMessage, deletePlanAndSessions } from "../lib/plan-chat.js";
import { chatWithPlan } from "../lib/trainer.js";
import { getAiSettingsWithKey } from "../lib/ai-settings.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;

function isExpired(plan) {
  const created = new Date(plan.created_at).getTime();
  return Date.now() - created > CHAT_WINDOW_MS;
}

function canChat(plan) {
  return !isExpired(plan);
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
    if (isExpired(plan)) {
      return sendJson(c.res, 403, {
        error: "El chat con la IA ha expirado (disponible durante 24h desde la generación del plan).",
      });
    }
    const body = await readBody(c.req);
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return sendJson(c.res, 400, { error: "El mensaje no puede estar vacío" });
    }
    const settings = getAiSettingsWithKey(c.tenantId);
    if (!settings) {
      return sendJson(c.res, 400, {
        error: "Configura un proveedor de IA en Configuración antes de chatear.",
      });
    }

    const result = await chatWithPlan({
      planId: plan.id,
      message,
      previousResponseId: plan.response_id ?? null,
      settings,
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
