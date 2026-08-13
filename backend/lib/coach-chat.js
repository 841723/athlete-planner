import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import {
  getTenantId,
  upsertSession,
  enrich,
  deleteSession,
  loadPlannedSessions,
  loadCompletedSessions,
  getSportCategory,
  toLocalDateKey,
} from "./sessions.js";
import { buildObjectives } from "./objectives.js";

// Marcador de las sesiones planificadas propuestas por el entrenador IA.
// Las planificadas manuales del atleta no llevan plan_id y se conservan
// siempre; el chat solo reemplaza el futuro marcado como "coach".
export const COACH_PLAN_ID = "coach";

export function listChatMessages() {
  return getDb()
    .prepare(
      "SELECT id, tenant_id, role, content, created_at FROM chat_messages WHERE tenant_id = ? ORDER BY created_at"
    )
    .all(getTenantId());
}

export function addChatMessage(role, content) {
  getDb()
    .prepare(
      "INSERT INTO chat_messages (id, tenant_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(randomUUID(), getTenantId(), role, content, new Date().toISOString());
}

export function getChatState(tenantId = getTenantId()) {
  const row = getDb()
    .prepare(
      "SELECT chat_pending, chat_response_id, chat_context_hash, chat_instructions FROM tenant_settings WHERE tenant_id = ?"
    )
    .get(tenantId);
  return {
    chatPending: Boolean(row?.chat_pending),
    chatResponseId: row?.chat_response_id ?? null,
    chatContextHash: row?.chat_context_hash ?? null,
    chatInstructions: row?.chat_instructions ?? "",
  };
}

function upsertSetting(column) {
  const db = getDb();
  return (tenantId, value) => {
    const bound = column === "chat_pending" ? (value ? 1 : 0) : value;
    return db
      .prepare(
        `INSERT INTO tenant_settings (tenant_id, ${column}) VALUES (?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET ${column} = excluded.${column}`
      )
      .run(tenantId, bound);
  };
}

export const setChatPending = upsertSetting("chat_pending");
export const updateChatResponseId = upsertSetting("chat_response_id");
export const updateChatContextHash = upsertSetting("chat_context_hash");
export const updateChatInstructions = upsertSetting("chat_instructions");

// Libera un chat atascado en "escribiendo" cuando no hay mensaje reciente y
// devuelve 1 (o 0 si el chat sigue pendiente de forma legítima).
export function recoverStaleChat(tenantId) {
  const state = getChatState(tenantId);
  if (!state.chatPending) return 0;
  const last = getDb()
    .prepare("SELECT created_at FROM chat_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(tenantId);
  const lastAt = last?.created_at ? new Date(last.created_at).getTime() : null;
  const cutoff = Date.now() - 10 * 60 * 1000;
  if (lastAt != null && lastAt >= cutoff) return 0;
  setChatPending(tenantId, false);
  updateChatResponseId(tenantId, null);
  return 1;
}

function isCoachSession(session) {
  return session.plan_id != null;
}

// Borra solo las sesiones planificadas futuras del entrenador (no fusionadas).
// Las planificadas manuales del atleta y el pasado (haya sido realizado o no)
// se conservan intactos: el chat nunca los modifica.
export function deleteFutureCoachSessions() {
  const planned = loadPlannedSessions().filter((s) => isCoachSession(s));
  const todayKey = toLocalDateKey(new Date());
  for (const s of planned) {
    if (s.merged_with) continue;
    if ((s.start_date_local ?? "").slice(0, 10) < todayKey) continue;
    deleteSession(s.id);
  }
}

export function replaceFuturePlannedSessions(rawSessions) {
  // Solo se reemplaza la parte futura propuesta por el entrenador. Las
  // planificadas pasadas (hayan sido realizadas o no) se conservan intactas.
  deleteFutureCoachSessions();

  const completed = loadCompletedSessions();
  const todayKey = toLocalDateKey(new Date());

  const created = [];
  for (const raw of rawSessions) {
    if (!raw?.sport || !raw?.start_date_local) continue;
    const date = String(raw.start_date_local).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayKey) continue;

    // No se vuelve a planificar una sesión cuya actividad ya se realizó ese
    // día y categoría de deporte: impedir que reaparezcan en el calendario.
    const cat = getSportCategory(raw.sport);
    const alreadyDone = completed.some(
      (c) =>
        (c.start_date_local ?? "").slice(0, 10) === date &&
        getSportCategory(c.sport) === cat
    );
    if (alreadyDone) continue;

    const session = {
      schema_version: 2,
      id: randomUUID(),
      plan_id: COACH_PLAN_ID,
      sport: raw.sport,
      title: raw.title,
      name: raw.name ?? raw.title,
      start_date_local: raw.start_date_local,
      workout_text: raw.workout_text,
    };
    upsertSession(getTenantId(), "planned", session);
    created.push({ ...enrich(session), objectives: buildObjectives(session) });
  }
  return created;
}