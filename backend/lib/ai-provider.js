import { logAiRequest } from "./ai-logs.js";
import { listModels, runConversation } from "./opencode.js";
import { getProvider, getProviderById, getProviderName, PROVIDER_LIST, CHAT_PROVIDERS, DEFAULT_PRICING } from "./providers.js";
import { getEnabledProviders, isProviderEnabled, getOpencodeBaseUrl } from "./global-settings.js";
import { getCatalogModel, effectivePrice } from "./opencode-catalog.js";

export { getProvider, getProviderById, getProviderName, DEFAULT_PRICING };

// Tiempo máximo de espera de las llamadas HTTP directas a los proveedores de
// chat/plan (gemini y compatibles con OpenAI). opencode gestiona su propio
// timeout de espera. Si el proveedor no responde, abortamos para no dejar el
// chat del plan atascado en "escribiendo" indefinidamente.
const CHAT_TIMEOUT_MS = 5 * 60 * 1000;
const PLAN_TIMEOUT_MS = 10 * 60 * 1000;

async function fetchWithTimeout(endpoint, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(endpoint, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Lista de proveedores disponibles para los tenants: solo los habilitados
// por el administrador global (global_settings.enabled_providers).
export function getProvidersList() {
  const enabled = getEnabledProviders();
  return PROVIDER_LIST.filter((p) => enabled.has(p.id)).map((p) => ({ ...p }));
}

export function getProviderEnabled(id) {
  return isProviderEnabled(id);
}

function tokensFromUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const input = usage.promptTokenCount ?? usage.input_tokens ?? usage.prompt_tokens ?? null;
  const output = usage.candidatesTokenCount ?? usage.output_tokens ?? usage.completion_tokens ?? null;
  if (input == null && output == null) return null;
  return { input: input ?? 0, output: output ?? 0 };
}

export function computeCost(providerId, usage, pricing = null) {
  const tokens = tokensFromUsage(usage);
  if (!tokens) return { inputTokens: null, outputTokens: null, cost: null };
  const prices = pricing?.[providerId] ?? DEFAULT_PRICING[providerId] ?? null;
  const cost = prices
    ? (tokens.input / 1_000_000) * (prices.input_per_mtok ?? 0) +
      (tokens.output / 1_000_000) * (prices.output_per_mtok ?? 0)
    : null;
  return {
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cost: cost == null ? null : Math.round(cost * 10000) / 10000,
  };
}

function isoLocalDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T19:00:00`;
}

function mockTextFor({ input, systemPrompt }) {
  const combined = `${systemPrompt ?? ""}\n\n${input ?? ""}`;
  if (combined.includes("MENSAJE DEL ATLETA")) {
    return JSON.stringify({
      reply:
        "Respuesta simulada del proveedor mock (sin coste real). Conecta Google Gemini en Configuración → IA para respuestas reales. No se han modificado sesiones.",
      sessions: [],
    });
  }
  if (combined.includes("Genera un plan de entrenamiento")) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return JSON.stringify({
      comments:
        "Plan generado con el proveedor mock. Sustitúyelo por un plan real configurando Google Gemini en Configuración → IA.",
      sessions: [
        {
          sport: "running",
          title: "Carrera en Z2",
          name: "Rodaje suave",
          start_date_local: isoLocalDate(today),
          workout_text: "40 min @ Z2",
        },
        {
          sport: "cycling",
          title: "Bici en rodillo",
          name: "Rodillo suave",
          start_date_local: isoLocalDate(tomorrow),
          workout_text: "45 min suaves\n10 min @90W",
        },
      ],
      updated_profile: null,
    });
  }
  if (combined.includes("asigna un título") || combined.includes("título a cada una")) {
    return JSON.stringify({ titles: [] });
  }
  return "OK";
}

async function mockCall(model, text) {
  const total = Math.round((text.length + 80) / 4);
  const usage = {
    promptTokenCount: Math.max(1, Math.round(total / 2)),
    candidatesTokenCount: Math.max(1, total - Math.round(total / 2)),
    totalTokenCount: Math.max(1, total),
  };
  await new Promise((r) => setTimeout(r, 250));
  return {
    text,
    responseId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    usage,
  };
}

function logFields(actor) {
  return {
    tenantId: actor?.tenantId ?? null,
    userId: actor?.userId ?? null,
    apiKeyId: actor?.apiKeyId ?? null,
    authMethod: actor?.authMethod ?? "unknown",
    actor: actor?.display ?? null,
  };
}

// opencode no es un endpoint de chat simple: se crea una sesión, se envía el
// prompt y se espera a que el agente quede idle. La instancia es local y no
// necesita API key (el auth básico opcional va en la userinfo de base_url).
async function callOpencode(settings, { systemPrompt, input, sessionId = null }, actor) {
  const providerId = "opencode";
  const baseUrl = getOpencodeBaseUrl();
  const model = settings?.model;
  if (!model) throw new Error("No hay modelo configurado para el proveedor opencode");
  const catalog = getCatalogModel(model, "opencode");
  if (!catalog?.enabled || catalog.input_price == null || catalog.output_price == null) {
    throw new Error(`El modelo "${model}" no está disponible para este tenant`);
  }

  const started = Date.now();
  let text = null;
  let ok = true;
  let status = null;
  let errorMessage = null;
  let responseId = null;
  let inputTokens = null;
  let outputTokens = null;
  let cost = null;
  let catalogPrice = null;

  try {
    const models = await listModels(baseUrl);
    const info = models.find((m) => m.id === model) ?? null;
    if (!info) {
      throw new Error(`El modelo "${model}" no está disponible en la instancia de opencode`);
    }
    // El precio efectivo lo define el catálogo global del administrador
    // (precio del catálogo si existe; si no, el que expone la instancia).
    const price = effectivePrice(model, {
      input_per_mtok: info.input_per_mtok,
      output_per_mtok: info.output_per_mtok,
    });
    catalogPrice = price;

    const result = await runConversation({
      baseUrl,
      modelId: model,
      modelProviderId: info.providerID,
      systemPrompt,
      input,
      sessionId,
    });
    text = result.text;
    responseId = result.responseId;
    ({ inputTokens, outputTokens, cost } = computeCost(providerId, result.usage, price ? { opencode: price } : null));
    return { text, responseId };
  } catch (err) {
    ok = false;
    errorMessage = err.message;
    throw err;
  } finally {
    await logAiRequest({
      ...logFields(actor),
      provider: providerId,
      model,
      endpoint: baseUrl,
      apiKey: "",
      input: `${systemPrompt}\n\n---\n\n${input}`,
      response: ok ? text : errorMessage,
      status,
      ok,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      cost,
      currency: catalog.currency,
    });
  }
}

export async function callAiChat(settings, { systemPrompt, input, previousResponseId = null }, actor = null) {
  const providerId = settings?.provider ?? "gemini";
  if (!isProviderEnabled(providerId)) {
    throw new Error(`El proveedor de IA "${providerId}" no está habilitado por el administrador`);
  }
  const base = getProvider(providerId);
  if (!base) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

  if (providerId === "opencode") {
    return callOpencode(settings, { systemPrompt, input, sessionId: previousResponseId ?? null }, actor);
  }

  const isMock = providerId === "mock";

  if (isMock) {
    const started = Date.now();
    const text = mockTextFor({ input, systemPrompt });
    const { responseId, usage } = await mockCall(base.defaultModel, text);
    const { inputTokens, outputTokens, cost } = computeCost(providerId, usage, settings?.pricing);
    await logAiRequest({
      ...logFields(actor),
      provider: providerId,
      model: base.defaultModel,
      endpoint: "mock://callAiChat",
      apiKey: "",
      input: `${systemPrompt}\n\n---\n\n${input}`,
      response: text,
      status: 200,
      ok: true,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      cost,
      currency: settings?.currency ?? null,
    });
    return { text, responseId };
  }

  const chatProvider = CHAT_PROVIDERS[providerId];

  if (!chatProvider) {
    const userPrompt = `${input}`;
    const text = await callAi(settings, { systemPrompt, userPrompt }, actor);
    return { text, responseId: null };
  }

  const apiKey = settings?.api_key;
  if (!apiKey) throw new Error("No hay API key configurada para el proveedor de IA");
  if (!settings?.model && !base.defaultModel) {
    throw new Error("No hay modelo configurado para el proveedor de IA");
  }

  const model = settings?.model || base.defaultModel;
  const baseUrl = settings?.base_url || base.defaultBaseUrl;
  if (!baseUrl) throw new Error(`Falta base_url para el proveedor ${providerId}`);

  const endpoint = chatProvider.buildEndpoint(baseUrl);
  const body = chatProvider.buildBody({ systemPrompt, input, model, previousResponseId });
  const headers = {
    "Content-Type": "application/json",
    ...base.authHeaders(apiKey),
    ...(chatProvider.extraHeaders ? chatProvider.extraHeaders() : {}),
  };

  const started = Date.now();
  let response;
  let text;
  let ok = true;
  let status = null;
  let errorMessage = null;
  let responseId = null;
  let inputTokens = null;
  let outputTokens = null;
  let cost = null;

  try {
    response = await fetchWithTimeout(
      endpoint,
      { method: "POST", headers, body: JSON.stringify(body) },
      CHAT_TIMEOUT_MS
    );
    status = response.status;
    if (!response.ok) {
      const errText = await response.text();
      errorMessage = `Error de la API de ${base.name}: ${status} - ${errText}`;
      throw new Error(errorMessage);
    }
    const data = await response.json();
    text = chatProvider.extractText(data);
    responseId = chatProvider.extractResponseId(data);
    if (!text) throw new Error(`Respuesta vacía de la API de ${base.name}`);
    const usage = chatProvider.extractUsage?.(data) ?? null;
    ({ inputTokens, outputTokens, cost } = computeCost(providerId, usage, settings?.pricing));
    return { text, responseId };
  } catch (err) {
    ok = false;
    errorMessage =
      err.name === "AbortError"
        ? `Tiempo de espera agotado: ${base.name} no respondió en ${Math.round(CHAT_TIMEOUT_MS / 1000)}s`
        : err.message;
    throw new Error(errorMessage);
  } finally {
    logAiRequest({
      ...logFields(actor),
      provider: providerId,
      model,
      endpoint,
      apiKey,
      input: `${systemPrompt}\n\n---\n\n${input}`,
      response: ok ? text : errorMessage,
      status,
      ok,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      cost,
      currency: settings?.currency ?? null,
    });
  }
}

export async function callAi(settings, { systemPrompt, userPrompt }, actor = null) {
  const providerId = settings?.provider ?? "gemini";
  if (!isProviderEnabled(providerId)) {
    throw new Error(`El proveedor de IA "${providerId}" no está habilitado por el administrador`);
  }
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

  if (providerId === "opencode") {
    const result = await callOpencode(settings, { systemPrompt, input: userPrompt, sessionId: null }, actor);
    return result.text;
  }

  const isMock = providerId === "mock";

  if (isMock) {
    const started = Date.now();
    const text = mockTextFor({ input: userPrompt, systemPrompt });
    const { responseId, usage } = await mockCall(provider.defaultModel, text);
    const { inputTokens, outputTokens, cost } = computeCost(providerId, usage, settings?.pricing);
    await logAiRequest({
      ...logFields(actor),
      provider: providerId,
      model: provider.defaultModel,
      endpoint: "mock://callAi",
      apiKey: "",
      input: `${systemPrompt}\n\n---\n\n${userPrompt}`,
      response: text,
      status: 200,
      ok: true,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      cost,
      currency: settings?.currency ?? null,
    });
    return text;
  }

  const apiKey = settings?.api_key;
  if (!apiKey) throw new Error("No hay API key configurada para el proveedor de IA");
  if (!settings?.model && !provider.defaultModel) {
    throw new Error("No hay modelo configurado para el proveedor de IA");
  }

  const model = settings?.model || provider.defaultModel;
  const baseUrl = settings?.base_url || provider.defaultBaseUrl;
  if (!baseUrl) throw new Error(`Falta base_url para el proveedor ${providerId}`);

  const endpoint = provider.buildEndpoint(baseUrl, model);
  const body = provider.buildBody({ systemPrompt, userPrompt, model });
  const headers = {
    "Content-Type": "application/json",
    ...provider.authHeaders(apiKey),
  };

  const started = Date.now();
  let response;
  let text;
  let ok = true;
  let status = null;
  let errorMessage = null;
  let inputTokens = null;
  let outputTokens = null;
  let cost = null;

  try {
    response = await fetchWithTimeout(
      endpoint,
      { method: "POST", headers, body: JSON.stringify(body) },
      PLAN_TIMEOUT_MS
    );
    status = response.status;
    if (!response.ok) {
      const errText = await response.text();
      errorMessage = `Error de la API de ${provider.name}: ${status} - ${errText}`;
      throw new Error(errorMessage);
    }
    const data = await response.json();
    text = provider.extractText(data);
    if (!text) throw new Error(`Respuesta vacía de la API de ${provider.name}`);
    const usage = provider.extractUsage?.(data) ?? null;
    ({ inputTokens, outputTokens, cost } = computeCost(providerId, usage, settings?.pricing));
    return text;
  } catch (err) {
    ok = false;
    errorMessage =
      err.name === "AbortError"
        ? `Tiempo de espera agotado: ${provider.name} no respondió en ${Math.round(PLAN_TIMEOUT_MS / 1000)}s`
        : err.message;
    throw new Error(errorMessage);
  } finally {
    logAiRequest({
      ...logFields(actor),
      provider: providerId,
      model,
      endpoint,
      apiKey,
      input: `${systemPrompt}\n\n---\n\n${userPrompt}`,
      response: ok ? text : errorMessage,
      status,
      ok,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      cost,
      currency: settings?.currency ?? null,
    });
  }
}
