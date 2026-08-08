import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import {
  getAthleteProfile,
  getSportCategory,
  getTenantId,
  loadCompletedSessions,
  loadPlannedSessions,
  enrich,
  saveAthleteProfile,
  upsertSession,
  updateSession,
} from "./sessions.js";
import { getProfileVersion, saveProfileVersion } from "./profile-history.js";
import { getPrompt } from "./ai-prompts.js";
import { savePlan } from "./plans.js";
import { buildObjectives } from "./objectives.js";
import { callAi, callAiChat } from "./ai-provider.js";
import { listPlanMessages, addPlanMessage, replacePlanSessions } from "./plan-chat.js";
import { subWeeks, format, parseISO } from "date-fns";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(import.meta.dirname, "..", "..", "data");
const SYSTEM_PROMPT_PATH = path.join(DATA_DIR, "trainer-system-prompt.txt");
const TITLES_SYSTEM_PROMPT_PATH = path.join(DATA_DIR, "session-titles-system-prompt.txt");

function loadSystemPrompt() {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, "utf8");
  } catch {
    throw new Error("No se pudo cargar el system prompt del entrenador");
  }
}

function loadTitlesSystemPrompt() {
  try {
    return fs.readFileSync(TITLES_SYSTEM_PROMPT_PATH, "utf8");
  } catch {
    throw new Error("No se pudo cargar el system prompt de títulos de sesión");
  }
}

function getRecentSessions(weeks = 8) {
  const allSessions = loadCompletedSessions();
  const now = new Date();
  const cutoffDate = subWeeks(now, weeks);

  return allSessions
    .filter((s) => {
      if (!s.start_date_local) return false;
      const sessionDate = new Date(s.start_date_local);
      return sessionDate >= cutoffDate;
    })
    .sort((a, b) => (a.start_date_local ?? "").localeCompare(b.start_date_local ?? ""));
}

function formatSessionForPrompt(session) {
  const date = session.start_date_local
    ? format(parseISO(session.start_date_local), "yyyy-MM-dd HH:mm")
    : "sin fecha";
  const pace = session.avg_pace_s_per_km
    ? `${Math.floor(session.avg_pace_s_per_km / 60)}:${String(Math.floor(session.avg_pace_s_per_km % 60)).padStart(2, "0")}/km`
    : "sin ritmo";
  const distance = session.distance_m
    ? `${(session.distance_m / 1000).toFixed(2)} km`
    : "sin distancia";
  const duration = session.moving_time_s
    ? `${Math.floor(session.moving_time_s / 3600)}h ${Math.floor((session.moving_time_s % 3600) / 60)}min`
    : "sin duración";
  const hr = session.avg_heartrate ? `FC: ${session.avg_heartrate} ppm` : "";
  const watts = session.avg_watts ? `Potencia: ${session.avg_watts}W` : "";
  const notes = session.notes ? `\n      Notas del atleta: ${session.notes}` : "";

  return `- ${date} | ${session.sport} | ${session.title ?? session.name} | ${distance} | ${pace} | ${duration} ${hr} ${watts}${notes}`.trim();
}

function formatSessionForTitles(session) {
  const date = session.start_date_local
    ? format(parseISO(session.start_date_local), "yyyy-MM-dd HH:mm")
    : "sin fecha";
  const distance = session.distance_m
    ? `${(session.distance_m / 1000).toFixed(2)} km`
    : "sin distancia";
  const pace = session.avg_pace_s_per_km
    ? `${Math.floor(session.avg_pace_s_per_km / 60)}:${String(Math.floor(session.avg_pace_s_per_km % 60)).padStart(2, "0")}/km`
    : "sin ritmo";
  const duration = session.moving_time_s
    ? `${Math.floor(session.moving_time_s / 3600)}h ${Math.floor((session.moving_time_s % 3600) / 60)}min`
    : "sin duración";
  const hr = session.avg_heartrate
    ? `FC media ${session.avg_heartrate} (máx ${session.max_heartrate ?? "?"})`
    : "";
  const watts = session.avg_watts ? `Potencia ${session.avg_watts}W (máx ${session.max_watts ?? "?"})` : "";
  const elev = session.total_elevation_gain_m ? `+${session.total_elevation_gain_m}m` : "";
  const zones = session.hr_zones?.length
    ? `Zonas FC: ${session.hr_zones.map((z) => `Z${z.zoneNumber} ${z.secsInZone}s`).join(", ")}`
    : "";
  const laps = session.segments?.length
    ? `Laps (${session.segments.length}): ${session.segments
        .map((s) => {
          const parts = [];
          if (s.distance_m) parts.push(`${(s.distance_m / 1000).toFixed(2)}km`);
          if (s.avg_pace_s_per_km)
            parts.push(
              `${Math.floor(s.avg_pace_s_per_km / 60)}:${String(Math.floor(s.avg_pace_s_per_km % 60)).padStart(2, "0")}/km`
            );
          if (s.avg_heartrate) parts.push(`FC${s.avg_heartrate}`);
          if (s.avg_watts) parts.push(`${s.avg_watts}W`);
          if (s.intensity) parts.push(s.intensity);
          return parts.join(" ");
        })
        .join(" | ")}`
    : "";
  const rpe = session.rpe != null ? `RPE ${session.rpe}` : "";
  const feel = session.feel != null ? `Feel ${session.feel}` : "";
  const notes = session.notes ? `Notas: ${session.notes}` : "";
  const name = session.name ? `Nombre Garmin: "${session.name}"` : "";

  return `- id: ${session.id} | ${date} | sport: ${session.sport} | ${name} | ${distance} | ${pace} | ${duration} | ${hr} | ${watts} | ${elev} | ${zones} | ${laps} | ${rpe} | ${feel} | ${notes}`
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseTitlesResponse(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se pudo encontrar JSON válido en la respuesta del LLM de títulos");
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed.titles) ? parsed.titles : [];
  } catch {
    throw new Error("Error al parsear la respuesta JSON de títulos");
  }
}

async function generateSessionTitles(sessions, settings, actor) {
  const untitled = sessions.filter((s) => !s.title && s.name);
  if (untitled.length === 0) return [];

  const systemPrompt = loadTitlesSystemPrompt();
  const sessionsText = untitled.map(formatSessionForTitles).join("\n");

  const userPrompt = `
Analiza las siguientes sesiones y asigna un título a cada una según las convenciones del system prompt.

SESIONES:

${sessionsText}

Responde únicamente con el JSON con los títulos.
`.trim();

  const responseText = await callAi(settings, { systemPrompt, userPrompt }, actor);
  const titles = parseTitlesResponse(responseText);

  const applied = [];
  for (const t of titles) {
    const id = String(t?.id ?? "");
    const title = String(t?.title ?? "").trim();
    if (!id || !title) continue;
    const session = untitled.find((s) => String(s.id) === id);
    if (!session) continue;
    updateSession(id, { title });
    applied.push({ id, title });
  }
  return applied;
}

function deriveProfileMetrics(sessions) {
  const metrics = {};

  const running = sessions.filter((s) => getSportCategory(s.sport) === "running");
  const runningZ2 = running.filter(
    (s) => s.avg_heartrate && s.avg_heartrate >= 120 && s.avg_heartrate <= 150
  );
  if (runningZ2.length > 0) {
    const avgHr = Math.round(runningZ2.reduce((a, s) => a + s.avg_heartrate, 0) / runningZ2.length);
    metrics.running = { current: `Rodajes Z2 cómodos entre ${avgHr - 5}-${avgHr + 5} ppm` };
  }

  const cycling = sessions.filter((s) => getSportCategory(s.sport) === "cycling");
  const cyclingWithWatts = cycling.filter((s) => s.avg_watts && s.avg_watts > 0);
  if (cyclingWithWatts.length > 0) {
    const avgW = Math.round(cyclingWithWatts.reduce((a, s) => a + s.avg_watts, 0) / cyclingWithWatts.length);
    metrics.cycling = { current_power: `~${avgW} W` };
  }

  const swimming = sessions.filter((s) => ["lap_swimming", "open_water_swimming"].includes(s.sport));
  const swimWithPace = swimming.filter((s) => s.avg_pace_s_per_km && s.avg_pace_s_per_km > 0);
  if (swimWithPace.length > 0) {
    const avgPaceKm = swimWithPace.reduce((a, s) => a + s.avg_pace_s_per_km, 0) / swimWithPace.length;
    const per100 = avgPaceKm / 10;
    const mm = Math.floor(per100 / 60);
    const ss = Math.round(per100 % 60);
    metrics.swimming = { current_pace: `${mm}:${String(ss).padStart(2, "0")}/100m` };
  }

  const lastSession = sessions[sessions.length - 1];
  if (lastSession?.weekNumber) metrics.goal = { current_week: lastSession.weekNumber };

  return metrics;
}

function mergeProfileMetrics(profile, metrics) {
  const updated = JSON.parse(JSON.stringify(profile ?? {}));
  const datos = updated.datos_del_atleta ??= {};
  const estado = datos.estado_actual ??= {};
  if (metrics.running) {
    estado.running = { ...(estado.running ?? {}), fc_z2: metrics.running.current };
  }
  if (metrics.cycling) {
    estado.cycling = { ...(estado.cycling ?? {}), potencia_w: metrics.cycling.current_power };
  }
  if (metrics.swimming) {
    estado.swimming = { ...(estado.swimming ?? {}), ritmo_100m: metrics.swimming.current_pace };
  }
  if (metrics.goal) {
    const estadoFisico = datos.estado_fisico ??= {};
    estadoFisico.semanas_consecutivas = String(metrics.goal.current_week);
    updated.goal = { ...(updated.goal ?? {}), current_week: metrics.goal.current_week };
  }
  return updated;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  if (Object.keys(profile).length === 0) return null;
  if (profile.datos_del_atleta) return profile;

  const out = {};
  const d = (out.datos_del_atleta = {});
  const estado = (d.estado_actual = {});
  if (profile.strengths?.running?.current) {
    estado.running = { fc_z2: profile.strengths.running.current };
  }
  if (profile.weaknesses?.cycling?.current_power) {
    estado.cycling = { potencia_w: profile.weaknesses.cycling.current_power };
  }
  if (profile.weaknesses?.swimming?.current_pace) {
    estado.swimming = { ritmo_100m: profile.weaknesses.swimming.current_pace };
  }
  if (profile.goal?.current_week) {
    d.estado_fisico = { semanas_consecutivas: String(profile.goal.current_week) };
  }
  if (profile.objetivo) d.objetivo = profile.objetivo;
  if (profile.nombre) d.datos_personales = { nombre: profile.nombre };
  if (profile.filosofia) out.filosofia = profile.filosofia;
  if (profile.trainer_behavior) out.trainer_behavior = profile.trainer_behavior;

  if (Object.keys(d).length === 0 && Object.keys(out).length === 0) return profile;
  return out;
}

function buildUserPrompt(comments, weeks, profile, metrics) {
  const sessions = getRecentSessions(8);

  const sessionsText = sessions.map(formatSessionForPrompt).join("\n");

  const today = format(new Date(), "yyyy-MM-dd");
  const targetDate = today;

  const currentWeek =
    profile?.datos_del_atleta?.estado_fisico?.semanas_consecutivas ??
    profile?.goal?.current_week ??
    null;
  const weekLabel = currentWeek != null ? `#${currentWeek}` : `#1`;

  const metricsLines = [];
  if (metrics?.goal?.current_week) metricsLines.push(`- Semana actual de entrenamiento: #${metrics.goal.current_week}`);
  if (metrics?.running?.current) metricsLines.push(`- Running Z2 (últimas 8 semanas): ${metrics.running.current}`);
  if (metrics?.cycling?.current_power) metricsLines.push(`- Ciclismo (últimas 8 semanas): ${metrics.cycling.current_power}`);
  if (metrics?.swimming?.current_pace) metricsLines.push(`- Natación (últimas 8 semanas): ${metrics.swimming.current_pace}`);
  const metricsText =
    metricsLines.length > 0
      ? `\nÚLTIMOS DATOS OBTENIDOS (derivados de tus sesiones de las últimas 8 semanas):\n${metricsLines.join("\n")}\n`
      : "";

  const profileText =
    profile && Object.keys(profile).length > 0
      ? JSON.stringify(profile, null, 2)
      : "(no hay perfil guardado)";

  return `
CONTEXTO ACTUAL:
- Hoy es: ${today}
- Semana actual de entrenamiento: ${weekLabel}
- El plan empieza HOY: ${targetDate}. Programa las sesiones a partir de hoy (hoy incluido), no en el futuro ni esperando al lunes.
- Sesiones de las últimas 8 semanas (incluye las notas que escribió el atleta tras cada sesión):

${sessionsText}
${metricsText}
PERFIL DEL ATLETA (JSON):
${profileText}

COMENTARIOS DEL ATLETA:
${comments}

Genera un plan de entrenamiento para las próximas ${weeks} semana(s). Responde con el JSON estructurado como se indica en las instrucciones.
Además, incluye un campo "updated_profile" con el perfil del atleta actualizado según tus observaciones de las últimas sesiones. updated_profile DEBE respetar exactamente el FORMATO DEL PERFIL DEL ATLETA indicado en el system prompt, con la clave raíz "datos_del_atleta". Si el perfil ya trae "datos_del_atleta", actualízalo manteniendo su estructura. No inventes campos fuera de ese esquema.
`.trim();
}

function parseLLMResponse(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se pudo encontrar JSON válido en la respuesta del LLM");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      comments: parsed.comments || "",
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      updated_profile: parsed.updated_profile || null,
    };
  } catch {
    throw new Error("Error al parsear la respuesta JSON del LLM");
  }
}

function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createPlannedSession(sessionData, planId) {
  const session = {
    schema_version: 2,
    id: randomUUID(),
    plan_id: planId ?? undefined,
    sport: sessionData.sport,
    title: sessionData.title,
    name: sessionData.name ?? sessionData.title,
    start_date_local: sessionData.start_date_local,
    workout_text: sessionData.workout_text,
  };

  upsertSession(getTenantId(), "planned", session);
  return { ...enrich(session), objectives: buildObjectives(session) };
}

function clearPlannedSessions() {
  getDb()
    .prepare(
      `DELETE FROM sessions WHERE tenant_id = ? AND kind = 'planned'
       AND (json_extract(data, '$.merged_with') IS NULL OR json_extract(data, '$.merged_with') = '')`
    )
    .run(getTenantId());
}

export async function generatePlan({ comments = "", weeks = 1, profileVersionId = null, promptId = null, settings, actor }) {
  const tenantId = getTenantId();

  let profile;
  if (profileVersionId) {
    const version = getProfileVersion(profileVersionId);
    if (version && version.tenant_id === tenantId) {
      profile = version.data;
    } else {
      profile = getAthleteProfile() ?? {};
    }
  } else {
    profile = getAthleteProfile() ?? {};
  }

  const recentSessions = getRecentSessions(8);
  const metrics = deriveProfileMetrics(recentSessions);
  const updatedProfile = mergeProfileMetrics(profile, metrics);

  let titlesUpdated = [];
  try {
    titlesUpdated = await generateSessionTitles(recentSessions, settings, actor);
  } catch (err) {
    console.error("Error generando títulos de sesión:", err.message);
  }

  let systemPrompt;
  if (promptId) {
    const prompt = getPrompt(promptId);
    if (prompt && prompt.tenant_id === tenantId) {
      systemPrompt = prompt.content;
    } else {
      systemPrompt = loadSystemPrompt();
    }
  } else {
    systemPrompt = loadSystemPrompt();
  }

  const userPrompt = buildUserPrompt(comments, weeks, updatedProfile, metrics);

  try {
    const { text: responseText, responseId } = await callAiChat(
      settings,
      { systemPrompt, input: userPrompt },
      actor
    );

    const { comments: llmComments, sessions: rawSessions, updated_profile } = parseLLMResponse(responseText);

    const prompt = promptId ? getPrompt(promptId) : null;
    const planId = savePlan(tenantId, {
      comments: llmComments,
      weeks,
      profileVersionId,
      promptId,
      promptName: prompt?.name ?? null,
      responseId,
    });

    clearPlannedSessions();

    const createdSessions = [];
    for (const rawSession of rawSessions) {
      try {
        const created = createPlannedSession(rawSession, planId);
        createdSessions.push(created);
      } catch (err) {
        console.error("Error creando sesión planificada:", err.message);
      }
    }

    let profileUpdated = false;
    if (updated_profile && typeof updated_profile === "object") {
      const normalized = normalizeProfile(updated_profile);
      if (normalized) {
        const versionId = saveProfileVersion(tenantId, normalized, "ai");
        if (versionId) {
          saveAthleteProfile(tenantId, normalized);
          profileUpdated = true;
        }
      }
    }

    return {
      planId,
      comments: llmComments,
      sessions: createdSessions,
      titlesUpdated,
      profileUpdated,
    };
  } catch (err) {
    throw new Error(`Error al generar el plan: ${err.message}`);
  }
}

const CHAT_SYSTEM_PROMPT_PATH = path.join(DATA_DIR, "trainer-chat-system-prompt.txt");

function loadChatSystemPrompt() {
  try {
    return fs.readFileSync(CHAT_SYSTEM_PROMPT_PATH, "utf8");
  } catch {
    throw new Error("No se pudo cargar el system prompt del chat de entrenador");
  }
}

function formatPlannedSessionForPrompt(session) {
  const date = session.start_date_local
    ? format(parseISO(session.start_date_local), "yyyy-MM-dd HH:mm")
    : "sin fecha";
  return `- ${date} | ${session.sport} | ${session.title ?? session.name} | ${session.workout_text ?? ""}`.trim();
}

function buildChatUserPrompt(planId, message) {
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  const planText =
    planned.length > 0
      ? planned.map(formatPlannedSessionForPrompt).join("\n")
      : "(no hay sesiones planificadas para este plan)";
  const profile = getAthleteProfile();
  const profileText =
    profile && Object.keys(profile).length > 0
      ? JSON.stringify(profile, null, 2)
      : "(no hay perfil guardado)";
  const today = format(new Date(), "yyyy-MM-dd");

  return `
Hoy es: ${today}

PERFIL DEL ATLETA (JSON):
${profileText}

PLAN ACTUAL (sesiones planificadas de este plan):
${planText}

MENSAJE DEL ATLETA:
${message}

Responde con el JSON indicado en el system prompt.
`.trim();
}

function parseChatResponse(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No se pudo encontrar JSON válido en la respuesta del chat");
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    throw new Error("Error al parsear la respuesta JSON del chat");
  }
}

export async function chatWithPlan({ planId, message, previousResponseId, settings, actor }) {
  const tenantId = getTenantId();
  const systemPrompt = loadChatSystemPrompt();
  const userPrompt = buildChatUserPrompt(planId, message);

  const { text, responseId } = await callAiChat(
    settings,
    { systemPrompt, input: userPrompt, previousResponseId },
    actor
  );

  const parsed = parseChatResponse(text);
  const reply = parsed.reply || text;

  addPlanMessage(planId, "user", message);
  addPlanMessage(planId, "assistant", reply);

  let sessionsUpdated = [];
  if (parsed.sessions.length > 0) {
    sessionsUpdated = replacePlanSessions(planId, parsed.sessions);
  }

  return { reply, sessionsUpdated, responseId, tenantId };
}
