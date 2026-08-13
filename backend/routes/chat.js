import { getDefaultAiConfig } from "../lib/ai-configs.js";
import {
  getChatState,
  listChatMessages,
  addChatMessage,
  setChatPending,
  updateChatResponseId,
  updateChatInstructions,
  recoverStaleChat,
} from "../lib/coach-chat.js";
import { createJob } from "../lib/jobs.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

export function register(router) {
  router.get("/api/chat", (c) => {
    recoverStaleChat(c.tenantId);
    const config = getDefaultAiConfig(c.tenantId, false);
    const state = getChatState(c.tenantId);
    return sendJson(c.res, 200, {
      canChat: Boolean(config),
      chatPending: state.chatPending,
      chatInstructions: state.chatInstructions ?? "",
      messages: listChatMessages(),
    });
  });

  router.put("/api/chat/settings", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const instructions = String(body?.instructions ?? "").trim();
    if (instructions.length > 5000) return sendJson(c.res, 400, { error: "Las instrucciones no pueden superar 5.000 caracteres" });
    updateChatInstructions(c.tenantId, instructions);
    return sendJson(c.res, 200, { instructions });
  });

  router.post("/api/chat", async (c) => {
    if (!canWrite(c.membership)) {
      return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    }
    const config = getDefaultAiConfig(c.tenantId, true);
    if (!config) {
      return sendJson(c.res, 400, {
        error: "Configura un proveedor de IA en Configuración antes de chatear.",
      });
    }
    const state = getChatState(c.tenantId);
    if (state.chatPending) {
      return sendJson(c.res, 409, {
        error: "El entrenador aún está escribiendo la respuesta al mensaje anterior.",
      });
    }
    const body = await readBody(c.req);
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return sendJson(c.res, 400, { error: "El mensaje no puede estar vacío" });
    }

    // Persist the athlete's message before the provider call so it remains in
    // the thread even if the model times out or returns an invalid response.
    addChatMessage("user", message);
    setChatPending(c.tenantId, true);

    const job = createJob({
      tenantId: c.tenantId,
      userId: c.actor?.userId ?? null,
      type: "coach_chat",
      dedupeKey: `coach-chat`,
      payload: {
        message,
        previousResponseId: state.chatResponseId ?? null,
      },
      deepLink: `/${c.tenantId}/trainer`,
    });

    return sendJson(c.res, 202, { pending: true, jobId: job.id });
  });

  router.post("/api/chat/cancel", (c) => {
    if (!canWrite(c.membership)) {
      return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    }
    // Libera el bloqueo del chat y descarta el hilo anterior para que el
    // próximo mensaje arranque con contexto completo (sin quedar colgado del
    // hilo que no respondió). El propio entrenador, si la llamada IA aún sigue
    // en vuelo, añadirá su respuesta al final sin volver a bloquear.
    setChatPending(c.tenantId, false);
    updateChatResponseId(c.tenantId, null);
    return sendJson(c.res, 200, { cancelled: true });
  });
}