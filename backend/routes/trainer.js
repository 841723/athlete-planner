import { generatePlan } from "../lib/trainer.js";
import { listPlans, getPlan, getPlanDto, savePlan, hasActiveGeneration, updatePlanStatus } from "../lib/plans.js";
import { getPrompt } from "../lib/ai-prompts.js";
import { getAiConfigWithKey, getDefaultAiConfig } from "../lib/ai-configs.js";
import { withTenant } from "../lib/sessions.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

function toPlanDto(p) {
  return {
    id: p.id,
    createdAt: p.created_at,
    comments: p.comments ?? "",
    weeks: p.weeks,
    status: p.status,
    error: p.error ?? null,
    responseId: p.response_id ?? null,
    aiConfigId: p.aiConfigId ?? null,
    promptId: p.promptId ?? null,
    promptName: p.promptName ?? null,
  };
}

function startBackgroundGeneration({ planId, comments, weeks, aiConfigId, promptId, equipment, settings, actor, tenantId }) {
  withTenant(tenantId, () =>
    generatePlan({
      comments,
      weeks,
      aiConfigId,
      promptId,
      equipment,
      settings,
      actor,
      planId,
    }).catch((err) => console.error("Generación asíncrona del plan falló:", err.message))
  );
}

function resolveConfig(c, aiConfigId) {
  if (aiConfigId) return getAiConfigWithKey(c.tenantId, aiConfigId);
  return getDefaultAiConfig(c.tenantId, true);
}

export function register(router) {
  router.get("/api/plans", (c) => {
    return sendJson(c.res, 200, listPlans(c.tenantId).map(toPlanDto));
  });

  router.get("/api/plans/:id", (c) => {
    const plan = getPlanDto(c.tenantId, c.params.id);
    if (!plan) return sendJson(c.res, 404, { error: "Plan no encontrado" });
    return sendJson(c.res, 200, { ...toPlanDto(plan), plannedSessions: plan.plannedSessions });
  });

  router.post("/api/generate-plan", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (hasActiveGeneration(c.tenantId)) {
      return sendJson(c.res, 409, { error: "Ya hay un plan en generación. Espera a que termine antes de generar otro." });
    }
    const body = await readBody(c.req);
    const settings = resolveConfig(c, body?.aiConfigId ?? null);
    if (!settings) {
      return sendJson(c.res, 400, { error: "Configura un proveedor de IA en Configuración antes de generar un plan." });
    }
    const comments = String(body?.comments ?? "");
    const weeks = Number(body?.weeks ?? 1);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      return sendJson(c.res, 400, { error: "weeks debe ser un entero entre 1 y 52" });
    }
    if (comments.length > 10_000) {
      return sendJson(c.res, 400, { error: "Los comentarios no pueden superar 10.000 caracteres" });
    }
    const promptId = body?.promptId ?? null;
    const equipment = Array.isArray(body?.equipment) ? body.equipment.map(String) : null;

    const prompt = promptId ? getPrompt(promptId) : null;
    if (promptId && (!prompt || prompt.tenant_id !== c.tenantId)) {
      return sendJson(c.res, 404, { error: "Prompt no encontrado" });
    }
    const planId = savePlan(c.tenantId, {
      comments: "",
      weeks,
      aiConfigId: settings.id,
      promptId,
      promptName: prompt?.name ?? null,
      status: "pending",
      requestComments: comments,
    });

    startBackgroundGeneration({
      planId,
      comments,
      weeks,
      aiConfigId: settings.id,
      promptId,
      equipment,
      settings,
      actor: c.actor,
      tenantId: c.tenantId,
    });

    return sendJson(c.res, 202, toPlanDto(getPlan(c.tenantId, planId)));
  });

  router.post("/api/plans/:id/generate", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const plan = getPlan(c.tenantId, c.params.id);
    if (!plan) return sendJson(c.res, 404, { error: "Plan no encontrado" });
    if (plan.status === "pending" || plan.status === "generating") {
      return sendJson(c.res, 409, { error: "El plan ya está en generación." });
    }
    if (plan.status !== "failed") {
      return sendJson(c.res, 409, { error: "Solo se pueden reintentar planes con error." });
    }
    const settings = resolveConfig(c, plan.aiConfigId ?? null);
    if (!settings) {
      return sendJson(c.res, 400, { error: "Configura un proveedor de IA en Configuración antes de generar un plan." });
    }

    updatePlanStatus(plan.id, "pending");

    startBackgroundGeneration({
      planId: plan.id,
      comments: plan.requestComments ?? "",
      weeks: plan.weeks ?? 1,
      aiConfigId: settings.id,
      promptId: plan.promptId ?? null,
      equipment: null,
      settings,
      actor: c.actor,
      tenantId: c.tenantId,
    });

    return sendJson(c.res, 202, toPlanDto(getPlan(c.tenantId, plan.id)));
  });
}
