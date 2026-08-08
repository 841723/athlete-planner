import { logAiRequest } from "./ai-logs.js";

const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
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
  },
  // openai: {
  //   name: "OpenAI",
  //   defaultBaseUrl: "https://api.openai.com/v1",
  //   defaultModel: "gpt-4o",
  //   buildEndpoint(baseUrl) {
  //     return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  //   },
  //   authHeaders(apiKey) {
  //     return { Authorization: `Bearer ${apiKey}` };
  //   },
  //   buildBody({ systemPrompt, userPrompt, model }) {
  //     return {
  //       model,
  //       messages: [
  //         { role: "system", content: systemPrompt },
  //         { role: "user", content: userPrompt },
  //       ],
  //       temperature: 0.7,
  //       max_tokens: 8192,
  //     };
  //   },
  //   extractText(data) {
  //     return data?.choices?.[0]?.message?.content ?? null;
  //   },
  // },
  // openai_compatible: {
  //   name: "OpenAI-compatible (endpoint propio)",
  //   defaultBaseUrl: "",
  //   defaultModel: "",
  //   buildEndpoint(baseUrl) {
  //     return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  //   },
  //   authHeaders(apiKey) {
  //     return { Authorization: `Bearer ${apiKey}` };
  //   },
  //   buildBody({ systemPrompt, userPrompt, model }) {
  //     return {
  //       model,
  //       messages: [
  //         { role: "system", content: systemPrompt },
  //         { role: "user", content: userPrompt },
  //       ],
  //       temperature: 0.7,
  //       max_tokens: 8192,
  //     };
  //   },
  //   extractText(data) {
  //     return data?.choices?.[0]?.message?.content ?? null;
  //   },
  // },
  // anthropic: {
  //   name: "Anthropic Claude",
  //   defaultBaseUrl: "https://api.anthropic.com/v1",
  //   defaultModel: "claude-3-5-sonnet-20241022",
  //   buildEndpoint(baseUrl) {
  //     return `${baseUrl.replace(/\/+$/, "")}/messages`;
  //   },
  //   authHeaders(apiKey) {
  //     return {
  //       "x-api-key": apiKey,
  //       "anthropic-version": "2023-06-01",
  //     };
  //   },
  //   buildBody({ systemPrompt, userPrompt, model }) {
  //     return {
  //       model,
  //       system: systemPrompt,
  //       messages: [{ role: "user", content: userPrompt }],
  //       max_tokens: 8192,
  //       temperature: 0.7,
  //     };
  //   },
  //   extractText(data) {
  //     return data?.content?.[0]?.text ?? null;
  //   },
  // },
};

export function getAiProviderNames() {
  return Object.keys(PROVIDERS);
}

export function getProvider(providerId) {
  return PROVIDERS[providerId] ?? null;
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
  },
  openai: {
    buildEndpoint(baseUrl) {
      return `${baseUrl.replace(/\/+$/, "")}/responses`;
    },
    buildBody({ systemPrompt, input, model, previousResponseId }) {
      const body = {
        model,
        instructions: systemPrompt,
        input,
        store: false,
      };
      if (previousResponseId) body.previous_response_id = previousResponseId;
      return body;
    },
    extractText(data) {
      const out = data?.output ?? [];
      return (
        out
          .filter((o) => o.type === "message")
          .flatMap((o) => o.content ?? [])
          .filter((c) => c.type === "output_text")
          .map((c) => c.text)
          .join("\n") || null
      );
    },
    extractResponseId(data) {
      return data?.id ?? null;
    },
  },
};

export async function callAiChat(settings, { systemPrompt, input, previousResponseId = null }, actor = null) {
  const providerId = settings?.provider ?? "gemini";
  const base = getProvider(providerId);
  if (!base) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

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
    return { text, responseId };
  } catch (err) {
    ok = false;
    errorMessage = err.message;
    throw err;
  } finally {
    logAiRequest({
      tenantId: actor?.tenantId ?? null,
      userId: actor?.userId ?? null,
      apiKeyId: actor?.apiKeyId ?? null,
      authMethod: actor?.authMethod ?? "unknown",
      actor: actor?.display ?? null,
      provider: providerId,
      model,
      endpoint,
      apiKey,
      input: `${systemPrompt}\n\n---\n\n${input}`,
      response: ok ? text : errorMessage,
      status,
      ok,
      durationMs: Date.now() - started,
    });
  }
}

export async function callAi(settings, { systemPrompt, userPrompt }, actor = null) {
  const providerId = settings?.provider ?? "gemini";
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Proveedor de IA desconocido: ${providerId}`);

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
    return text;
  } catch (err) {
    ok = false;
    errorMessage = err.message;
    throw err;
  } finally {
    logAiRequest({
      tenantId: actor?.tenantId ?? null,
      userId: actor?.userId ?? null,
      apiKeyId: actor?.apiKeyId ?? null,
      authMethod: actor?.authMethod ?? "unknown",
      actor: actor?.display ?? null,
      provider: providerId,
      model,
      endpoint,
      apiKey,
      input: `${systemPrompt}\n\n---\n\n${userPrompt}`,
      response: ok ? text : errorMessage,
      status,
      ok,
      durationMs: Date.now() - started,
    });
  }
}
