import { logAiRequest } from "./ai-logs.js";

const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    needsApiKey: true,
    buildEndpoint(baseUrl, model) {
      return `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`;
    },
    authHeaders(apiKey) {
      return { "X-goog-api-key": apiKey };
    },
    buildBody({ systemPrompt, userPrompt, model }) {
      return {
        contents: [{ parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      };
    },
    extractText(data) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    },
    extractUsage(data) {
      return data?.usageMetadata ?? null;
    },
  },
  mock: {
    name: "Mock (desarrollo)",
    defaultBaseUrl: "",
    defaultModel: "mock-1",
    needsApiKey: false,
    buildEndpoint() {
      return "mock://generateContent";
    },
    authHeaders() {
      return {};
    },
    buildBody() {
      return {};
    },
    extractText(data) {
      return data?.text ?? null;
    },
    extractUsage(data) {
      return data?.usage ?? null;
    },
  },
};

export function getAiProviderNames() {
  return Object.keys(PROVIDERS);
}

export function getProvider(providerId) {
  return PROVIDERS[providerId] ?? null;
}

export const PROVIDER_LIST = [
  { id: "gemini", name: "Google Gemini", needsApiKey: true, defaultModel: "gemini-2.0-flash", defaultPricing: { input_per_mtok: 0.1, output_per_mtok: 0.4 } },
  { id: "mock", name: "Mock (desarrollo)", needsApiKey: false, defaultModel: "mock-1", defaultPricing: { input_per_mtok: 0, output_per_mtok: 0 } },
];

export function getProvidersList() {
  return PROVIDER_LIST.map((p) => ({ ...p }));
}

export function getProviderById(id) {
  return PROVIDER_LIST.find((p) => p.id === id) ?? null;
}

export function getProviderName(id) {
  return PROVIDER_LIST.find((p) => p.id === id)?.name ?? id;
}

const CHAT_PROVIDERS = {
  gemini: {
    buildEndpoint(baseUrl) {
      return `${baseUrl.replace(/\/+$/, "")}/interactions`;
    },
    extraHeaders() {
      return { "Api-Revision": "2026-05-20" };
    },
    buildBody({ systemPrompt, input, model, previousResponseId }) {
      const body = {
        model,
        input,
        system_instruction: systemPrompt,
      };
      if (previousResponseId) body.previous_interaction_id = previousResponseId;
      return body;
    },
    extractText(data) {
      const text = (data?.steps ?? [])
        .filter((s) => s.type === "model_output")
        .map((s) => (s.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join(""))
        .join("\n");
      return text || null;
    },
    extractResponseId(data) {
      return data?.id ?? null;
    },
    extractUsage(data) {
      return data?.usageMetadata ?? null;
    },
  },
  mock: {
    buildEndpoint() {
      return "mock://interactions";
    },
    buildBody() {
      return {};
    },
    extractText(data) {
      return data?.text ?? null;
    },
    extractResponseId(data) {
      return data?.responseId ?? null;
    },
    extractUsage(data) {
      return data?.usage ?? null;
    },
  },
};

export const DEFAULT_PRICING = {
  gemini: { input_per_mtok: 0.1, output_per_mtok: 0.4 },
  openai: { input_per_mtok: 2.5, output_per_mtok: 10 },
  anthropic: { input_per_mtok: 3, output_per_mtok: 15 },
  openai_compatible: { input_per_mtok: 0.5, output_per_mtok: 1.5 },
  mock: { input_per_mtok: 0, output_per_mtok: 0 },
};

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

export async function callAiChat(settings, { systemPrompt, input, previousResponseId = null }, actor = null) {
  const providerId = settings?.provider ?? "gemini";
  const base = getProvider(providerId);
  if (!base) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

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
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
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
    errorMessage = err.message;
    throw err;
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
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

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
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
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
    errorMessage = err.message;
    throw err;
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
