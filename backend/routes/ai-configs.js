import { getProvidersList, callAi } from "../lib/ai-provider.js";
import {
  listAiConfigs,
  getAiConfigWithKey,
  saveAiConfig,
  setDefaultAiConfig,
  deleteAiConfig,
  MAX_AI_CONFIGS,
} from "../lib/ai-configs.js";
import { sendJson, readBody } from "../lib/http.js";

export function register(router) {
  router.get("/api/ai-configs", (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar la IA" });
    }
    return sendJson(c.res, 200, {
      items: listAiConfigs(c.tenantId),
      providers: getProvidersList(),
      maxConfigs: MAX_AI_CONFIGS,
    });
  });

  router.post("/api/ai-configs", async (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar la IA" });
    }
    const body = await readBody(c.req);
    if (!body?.provider) return sendJson(c.res, 400, { error: "Falta provider" });
    if (!body?.name?.trim()) return sendJson(c.res, 400, { error: "Falta name" });

    const providerInfo = getProvidersList().find((p) => p.id === body.provider);
    if (!providerInfo) return sendJson(c.res, 400, { error: `Proveedor de IA no soportado: ${body.provider}` });
    if (providerInfo.needsApiKey && !body?.apiKey) {
      return sendJson(c.res, 400, { error: "Falta la API key para este proveedor" });
    }

    try {
      const id = saveAiConfig(c.tenantId, {
        name: body.name.trim(),
        provider: body.provider,
        apiKey: body.apiKey ?? "",
        model: body.model ?? null,
        baseUrl: body.baseUrl ?? null,
        currency: body.currency,
        chatDurationHours: body.chatDurationHours,
        pricing: body.pricing,
        isDefault: !!body.isDefault,
      });
      return sendJson(c.res, 201, { id });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.put("/api/ai-configs/:id", async (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar la IA" });
    }
    const body = await readBody(c.req);
    if (!body?.provider) return sendJson(c.res, 400, { error: "Falta provider" });
    if (!body?.name?.trim()) return sendJson(c.res, 400, { error: "Falta name" });

    const providerInfo = getProvidersList().find((p) => p.id === body.provider);
    if (!providerInfo) return sendJson(c.res, 400, { error: `Proveedor de IA no soportado: ${body.provider}` });
    const existing = getAiConfigWithKey(c.tenantId, c.params.id);
    if (!existing) return sendJson(c.res, 404, { error: "Configuración de IA no encontrada" });
    if (providerInfo.needsApiKey && !body?.apiKey && !existing.api_key) {
      return sendJson(c.res, 400, { error: "Falta la API key para este proveedor" });
    }

    try {
      saveAiConfig(c.tenantId, {
        id: c.params.id,
        name: body.name.trim(),
        provider: body.provider,
        apiKey: body.apiKey ?? "",
        model: body.model ?? null,
        baseUrl: body.baseUrl ?? null,
        currency: body.currency,
        chatDurationHours: body.chatDurationHours,
        pricing: body.pricing,
        isDefault: !!body.isDefault,
      });
      return sendJson(c.res, 200, { ok: true });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.delete("/api/ai-configs/:id", (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar la IA" });
    }
    try {
      const deleted = deleteAiConfig(c.tenantId, c.params.id);
      if (!deleted) return sendJson(c.res, 404, { error: "Configuración de IA no encontrada" });
      c.res.writeHead(204);
      return c.res.end();
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.post("/api/ai-configs/:id/default", (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede configurar la IA" });
    }
    try {
      setDefaultAiConfig(c.tenantId, c.params.id);
      return sendJson(c.res, 200, { ok: true });
    } catch (err) {
      return sendJson(c.res, 400, { error: err.message });
    }
  });

  router.post("/api/ai-configs/:id/test", async (c) => {
    if (c.membership?.role !== "athlete") {
      return sendJson(c.res, 403, { error: "Solo el atleta puede probar la conexión" });
    }
    const settings = getAiConfigWithKey(c.tenantId, c.params.id);
    if (!settings) return sendJson(c.res, 404, { error: "Configuración de IA no encontrada" });
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
}
