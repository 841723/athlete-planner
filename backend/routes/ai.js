import { getAiSettings, getAiSettingsWithKey, saveAiSettings, chatDurationLabel } from "../lib/ai-settings.js";
import { callAi, getProvidersList } from "../lib/ai-provider.js";
import {
  getPrompts,
  savePrompt,
  deletePrompt,
  updatePrompt,
  duplicatePrompt,
  setActivePrompt,
} from "../lib/ai-prompts.js";
import { sendJson, readBody, canWrite, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/ai-settings", (c) => {
    const settings = getAiSettings(c.tenantId) ?? {};
    return sendJson(c.res, 200, {
      ...settings,
      providers: getProvidersList(),
      chatDurationLabel: chatDurationLabel(settings.chat_duration_hours),
    });
  });

  router.put("/api/ai-settings", async (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar el proveedor de IA" });
    }
    const body = await readBody(c.req);
    if (!body?.provider) return sendJson(c.res, 400, { error: "Falta provider" });

    const providerInfo = getProvidersList().find((p) => p.id === body.provider);
    if (!providerInfo) {
      return sendJson(c.res, 400, { error: `Proveedor de IA no soportado: ${body.provider}` });
    }
    const existing = getAiSettingsWithKey(c.tenantId);
    const hasSavedKey = !!existing?.api_key;
    if (providerInfo.needsApiKey && !body?.apiKey && !hasSavedKey) {
      return sendJson(c.res, 400, { error: "Falta la API key para este proveedor" });
    }

    saveAiSettings(c.tenantId, {
      provider: body.provider,
      apiKey: body.apiKey ?? "",
      model: body.model ?? null,
      baseUrl: body.baseUrl ?? null,
      currency: body.currency,
      chatDurationHours: body.chatDurationHours,
      pricing: body.pricing,
    });
    return sendJson(c.res, 200, { ok: true });
  });

  router.post("/api/ai-settings/test", async (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede probar la conexión" });
    }
    const settings = getAiSettingsWithKey(c.tenantId);
    if (!settings) return sendJson(c.res, 400, { error: "No hay proveedor de IA configurado" });
    try {
      await callAi(
        settings,
        { systemPrompt: "Eres un asistente de diagnóstico.", userPrompt: "Responde solo con 'OK'" },
        c.actor
      );
      return sendJson(c.res, 200, { ok: true });
    } catch (err) {
      return sendJson(c.res, 500, { error: err.message });
    }
  });

  router.get("/api/prompts", (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    return sendJson(c.res, 200, getPrompts(c.tenantId));
  });

  router.post("/api/prompts", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body?.name || !body?.content) return sendJson(c.res, 400, { error: "Falta name o content" });
    try {
      const id = savePrompt(c.tenantId, { name: body.name, content: body.content });
      return sendJson(c.res, 201, { id });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.put("/api/prompts/:id", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!body?.name || !body?.content) return sendJson(c.res, 400, { error: "Falta name o content" });
    const updated = updatePrompt(c.params.id, c.tenantId, { name: body.name, content: body.content });
    if (!updated) return sendJson(c.res, 404, { error: "Prompt no encontrado o es predefinido" });
    return sendJson(c.res, 200, { ok: true });
  });

  // Marca el prompt que se envía con cada mensaje del chat (solo uno activo por tenant).
  router.put("/api/prompts/:id/active", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const ok = setActivePrompt(c.params.id, c.tenantId);
    if (!ok) return sendJson(c.res, 404, { error: "Prompt no encontrado" });
    return sendJson(c.res, 200, { ok: true });
  });

  router.post("/api/prompts/:id/duplicate", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    try {
      const id = duplicatePrompt(c.params.id, c.tenantId);
      if (!id) return sendJson(c.res, 404, { error: "Prompt no encontrado" });
      return sendJson(c.res, 201, { id });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.delete("/api/prompts/:id", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const deleted = deletePrompt(c.params.id, c.tenantId);
    if (!deleted) return sendJson(c.res, 404, { error: "Prompt no encontrado o es predefinido" });
    c.res.writeHead(204);
    return c.res.end();
  });
}
