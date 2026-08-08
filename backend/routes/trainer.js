import { generatePlan } from "../lib/trainer.js";
import { listPlans } from "../lib/plans.js";
import { getAiSettingsWithKey } from "../lib/ai-settings.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

function toPlanDto(p) {
  return {
    id: p.id,
    createdAt: p.created_at,
    comments: p.comments ?? "",
    weeks: p.weeks,
    responseId: p.response_id ?? null,
    profileVersionId: p.profileVersionId ?? null,
    promptId: p.promptId ?? null,
    promptName: p.promptName ?? null,
  };
}

export function register(router) {
  router.get("/api/plans", (c) => {
    return sendJson(c.res, 200, listPlans(c.tenantId).map(toPlanDto));
  });

  router.post("/api/generate-plan", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const settings = getAiSettingsWithKey(c.tenantId);
    if (!settings) {
      return sendJson(c.res, 400, { error: "Configura un proveedor de IA en Configuración antes de generar un plan." });
    }
    const result = await generatePlan({
      comments: body?.comments ?? "",
      weeks: body?.weeks ?? 1,
      profileVersionId: body?.profileVersionId ?? null,
      promptId: body?.promptId ?? null,
      settings,
      actor: c.actor,
    });
    return sendJson(c.res, 200, result);
  });
}
