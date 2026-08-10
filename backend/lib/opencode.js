// Cliente HTTP para la instancia local de opencode (`opencode serve`).
// API documentada en doc.json (endpoints v2): /api/model, /api/session,
// /api/session/:id/prompt, /api/session/:id/wait, /api/session/:id/message.
//
// La instancia escucha por defecto en http://localhost:4096 (127.0.0.1).
// No usa API key: si base_url trae userinfo (http://user:pass@host) se envía
// Basic auth; si no, la conexión es local sin credenciales.

import { mkdirSync } from "node:fs";

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const PROMPT_TIMEOUT_MS = 60 * 1000;
const WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const modelCache = new Map(); // baseUrl -> { at, models }

function decodeMaybe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseBaseUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`base_url de opencode inválida: ${baseUrl}`);
  }
  const user = url.username ? decodeMaybe(url.username) : "";
  const pass = url.password ? decodeMaybe(url.password) : "";
  const headers =
    user || pass
      ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` }
      : {};
  url.username = "";
  url.password = "";
  return { base: url.toString().replace(/\/+$/, ""), headers };
}

async function opencodeFetch(base, path, { headers = {}, method = "GET", body = null, timeoutMs = 60_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`opencode (${method} ${path}): ${res.status}${text ? ` - ${text.slice(0, 400)}` : ""}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`opencode (${method} ${path}): tiempo de espera agotado`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// El modelo expone un array `cost` con tramos (p.ej. un tramo de contexto).
// El precio base es la entrada sin `tier`; los precios van por millón de tokens.
function pickCost(model) {
  const costs = Array.isArray(model?.cost) ? model.cost : [];
  const base = costs.find((c) => c && !c.tier) ?? costs[0];
  if (!base) return null;
  return {
    input_per_mtok: typeof base.input === "number" ? base.input : null,
    output_per_mtok: typeof base.output === "number" ? base.output : null,
  };
}

export function normalizeModels(raw) {
  const data = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m) => m && typeof m === "object" && m.id)
    .map((m) => ({
      id: m.id,
      providerID: m.providerID ?? null,
      name: m.name ?? m.id,
      enabled: m.enabled !== false,
      ...(pickCost(m) ?? { input_per_mtok: null, output_per_mtok: null }),
    }));
}

export function listModels(baseUrl, { force = false } = {}) {
  const { base, headers } = parseBaseUrl(baseUrl);
  const cached = modelCache.get(base);
  if (!force && cached && Date.now() - cached.at < MODEL_CACHE_TTL_MS) {
    return Promise.resolve(cached.models);
  }
  return opencodeFetch(base, "/api/model", { headers, timeoutMs: 15_000 }).then((data) => {
    const models = normalizeModels(data);
    // No cachear respuestas vacías: si la instancia acaba de arrancar y aún no
    // ha cargado sus modelos, el siguiente request reintentará en vez de
    // servirse una lista vacía durante el TTL.
    if (models.length > 0) modelCache.set(base, { at: Date.now(), models });
    return models;
  });
}

export function getWorkspaceDir() {
  const dir = process.env.OPENCODE_WORKSPACE || "/tmp/opencode-workspace";
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // si no se puede crear, opencode usará su directorio por defecto
  }
  return dir;
}

async function createSession(base, headers, workspaceDir, modelId, modelProviderId) {
  const data = await opencodeFetch(base, "/api/session", {
    method: "POST",
    headers,
    body: {
      location: { directory: workspaceDir },
      model: { id: modelId, providerID: modelProviderId },
    },
  });
  const id = data?.data?.id ?? data?.id;
  if (!id) throw new Error("opencode no devolvió un id de sesión al crearla");
  return id;
}

async function sendPrompt(base, headers, sessionId, text) {
  await opencodeFetch(base, `/api/session/${encodeURIComponent(sessionId)}/prompt`, {
    method: "POST",
    headers,
    body: { prompt: { text } },
    timeoutMs: PROMPT_TIMEOUT_MS,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Un mensaje de asistente se considera completado cuando tiene `finish` o
// `time.completed` (opencode lo rellena al terminar de generar).
function assistantCompleted(m) {
  if (!m || m?.type !== "assistant") return false;
  if (m.finish && ["stop", "error", "length", "tool"].includes(m.finish)) return true;
  return !!m?.time?.completed;
}

// Espera a que opencode termine la respuesta sondeando el endpoint de mensajes.
// No se usa POST /wait: en modo servidor (opencode serve 1.18.x) devuelve 503
// "Session wait is not available yet" incluso con la sesión inactiva.
async function waitForAssistant(base, headers, sessionId) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const data = await opencodeFetch(
        base,
        `/api/session/${encodeURIComponent(sessionId)}/message?order=asc`,
        { headers, timeoutMs: 30_000 }
      );
      const messages = Array.isArray(data) ? data : data?.data ?? [];
      const assistant = [...messages].reverse().find(assistantCompleted);
      if (assistant) {
        if (assistant.error) {
          throw new Error(`opencode devolvió un error: ${JSON.stringify(assistant.error).slice(0, 400)}`);
        }
        return assistant;
      }
      lastErr = null;
    } catch (err) {
      if (err.status === 404) throw err;
      lastErr = err;
    }
    await sleep(1500);
  }
  if (lastErr) throw lastErr;
  throw new Error("opencode: tiempo de espera agotado esperando la respuesta");
}

/**
 * Ejecuta una conversación contra opencode y devuelve el texto del asistente.
 * Si `sessionId` se pasa y la sesión ya no existe (p.ej. opencode reiniciado),
 * crea una nueva y reintenta una vez. La continuidad del chat se apoya en
 * reutilizar el mismo `sessionId` (devuelto como `responseId`).
 */
export async function runConversation({ baseUrl, modelId, modelProviderId, systemPrompt, input, sessionId = null }) {
  const { base, headers } = parseBaseUrl(baseUrl);
  const text = `${systemPrompt ?? ""}\n\n---\n\n${input ?? ""}`;
  const workspaceDir = getWorkspaceDir();

  const ensure = (id) => id ?? createSession(base, headers, workspaceDir, modelId, modelProviderId);

  let sid = await ensure(sessionId);
  try {
    await sendPrompt(base, headers, sid, text);
  } catch (err) {
    if (!sessionId || err.status !== 404) throw err;
    sid = await createSession(base, headers, workspaceDir, modelId, modelProviderId);
    await sendPrompt(base, headers, sid, text);
  }

  const assistant = await waitForAssistant(base, headers, sid);
  const parts = Array.isArray(assistant.content) ? assistant.content : [];
  const answer = parts
    .filter((p) => p?.type === "text")
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!answer) throw new Error("opencode devolvió una respuesta vacía");
  const tokens = assistant.tokens;
  const usage =
    tokens && (tokens.input != null || tokens.output != null)
      ? {
          input_tokens: Number(tokens.input) || 0,
          output_tokens: Number(tokens.output) || 0,
        }
      : null;
  return { text: answer, responseId: sid, usage };
}
