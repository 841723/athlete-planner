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

export async function getAuthStatus(baseUrl) {
  const { base, headers } = parseBaseUrl(baseUrl);
  const data = await opencodeFetch(base, "/provider", { headers, timeoutMs: 15_000 });
  const connected = new Set(Array.isArray(data?.connected) ? data.connected : []);
  return Object.fromEntries(
    (Array.isArray(data?.all) ? data.all : []).map((provider) => [
      provider.id,
      {
        providerID: provider.id,
        name: provider.name,
        connected: connected.has(provider.id),
      },
    ])
  );
}

export async function connectAuth(baseUrl, providerId, credentials) {
  if (!/^(opencode|opencode-go|zen|go)$/i.test(providerId)) {
    throw new Error("Proveedor OpenCode no permitido");
  }
  const { base, headers } = parseBaseUrl(baseUrl);
  await opencodeFetch(base, `/auth/${encodeURIComponent(providerId)}`, {
    method: "PUT", headers, body: credentials ?? {}, timeoutMs: 15_000,
  });
  return { providerID: providerId, connected: true };
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

function isNewMessage(message, minCreatedAt) {
  if (message?.time?.created == null || !minCreatedAt) return true;
  const created = new Date(message.time.created).getTime();
  // Algunas versiones/dev servers usan timestamps relativos o sintéticos.
  return !Number.isFinite(created) || created < 100_000_000_000 || created >= minCreatedAt;
}

// Espera a que opencode termine la respuesta sondeando el endpoint de mensajes.
// No se usa POST /wait: en modo servidor (opencode serve 1.18.x) devuelve 503
// "Session wait is not available yet" incluso con la sesión inactiva.
//
// Al reutilizar una sesión ya existe un mensaje de asistente completado del turno
// anterior; hay que ignorarlo y esperar al mensaje NUEVO. Para ello `startCount`
// indica cuántos mensajes había antes de enviar el prompt, y `minCreatedAt` es el
// instante en que se envió: la respuesta nueva debe ser posterior (por índice y,
// si hay timestamp, también por fecha).
async function waitForAssistant(base, headers, sessionId, { startCount = 0, minCreatedAt = 0 } = {}) {
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
      const assistant = [...messages]
        .reverse()
        .find(
          (m, i, arr) =>
            assistantCompleted(m) &&
            arr.length - 1 - i >= startCount &&
            isNewMessage(m, minCreatedAt)
        );
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

  // Al reutilizar una sesión, cuenta los mensajes existentes para poder distinguir
  // la respuesta de este turno de la del turno anterior al esperar.
  let startCount = 0;
  if (sessionId) {
    try {
      const data = await opencodeFetch(
        base,
        `/api/session/${encodeURIComponent(sessionId)}/message?order=asc`,
        { headers, timeoutMs: 30_000 }
      );
      startCount = Array.isArray(data) ? data.length : (data?.data ?? []).length;
    } catch {
      startCount = 0;
    }
  }

  try {
    await sendPrompt(base, headers, sid, text);
  } catch (err) {
    if (!sessionId || err.status !== 404) throw err;
    sid = await createSession(base, headers, workspaceDir, modelId, modelProviderId);
    startCount = 0;
    await sendPrompt(base, headers, sid, text);
  }

  const assistant = await waitForAssistant(base, headers, sid, { startCount, minCreatedAt: Date.now() - 2000 });
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
