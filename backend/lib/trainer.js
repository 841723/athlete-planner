import { randomUUID, createHash } from "node:crypto";
import { getDb } from "./db.js";
import {
  getAthleteProfile,
  getSportCategory,
  getWeekNumber,
  getTenantId,
  getTenantSettings,
  loadCompletedSessions,
  loadCompletedSessionsSince,
  loadPlannedSessions,
  enrich,
  saveAthleteProfile,
  upsertSession,
  updateSession,
} from "./sessions.js";
import { saveProfileVersion } from "./profile-history.js";
import { getPrompt, getRolePrompt, getFormatBlock } from "./ai-prompts.js";
import { savePlan, updatePlanStatus, updatePlanResult, getPlan, updatePlanContextHash } from "./plans.js";
import { buildObjectives } from "./objectives.js";
import { callAi, callAiChat } from "./ai-provider.js";
import { listPlanMessages, addPlanMessage, replacePlanSessions } from "./plan-chat.js";
import { getEquipmentLabels } from "./equipment.js";
import { getGoals } from "./goals.js";
import { getFocusSports } from "./meta.js";
import { subWeeks, format, parseISO, differenceInCalendarDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

function requireRolePrompt(role) {
  const prompt = getRolePrompt(getTenantId(), role);
  if (!prompt?.content) {
    throw new Error(`No se pudo cargar el prompt de "${role}" del tenant`);
  }
  return prompt.content;
}

// Los prompts (base, títulos y chat) viven en la BD por tenant (tabla ai_prompts),
// sembrados al crear el tenant. No hay prompts compartidos entre tenants.
// El bloque FORMATO DE RESPUESTA se extrae del prompt base del tenant (getFormatBlock)
// y se añade SIEMPRE a los prompts de plan, para que el LLM conozca el esquema JSON
// y el formato de workout_text.

function computeCurrentWeek(tenantId) {
  const settings = getTenantSettings(tenantId);
  const planStart = settings?.plan_start;
  if (!planStart) return null;
  const start = parseISO(planStart.length === 10 ? `${planStart}T00:00:00` : planStart);
  const anchor = startOfWeek(start, { weekStartsOn: 1 });
  const diffDays = differenceInCalendarDays(new Date(), anchor);
  const week = Math.floor(diffDays / 7) + 1;
  return week >= 1 ? week : 1;
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
  const out = JSON.parse(JSON.stringify(profile));
  delete out.nombre;
  delete out.filosofia;
  delete out.trainer_behavior;
  delete out.analisis_requerido;
  delete out.goal;
  const d = out.datos_del_atleta;
  if (d && typeof d === "object") {
    if (d.datos_personales && typeof d.datos_personales === "object") {
      delete d.datos_personales.nombre;
    }
    delete d.objetivo;
    if (d.estado_fisico && typeof d.estado_fisico === "object") {
      delete d.estado_fisico.semanas_consecutivas;
    }
  }
  return out;
}

export function getRecentSessions(weeks = 8) {
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

function formatTrainingDayForPrompt(value) {
  const date = parseISO(value);
  const week = getWeekNumber(date, getTenantSettings()?.training_week_one_start);
  return `${format(date, "EEEE", { locale: es })} #${week}`;
}

function formatSessionForPrompt(session) {
  const date = session.start_date_local ? formatTrainingDayForPrompt(session.start_date_local) : "sin fecha";
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
  const date = session.start_date_local ? formatTrainingDayForPrompt(session.start_date_local) : "sin fecha";
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

  const systemPrompt = requireRolePrompt("titles");
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

function isMeaningful(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function mergePreserving(current, updated) {
  if (updated == null || typeof updated !== "object" || Array.isArray(updated)) {
    return current == null ? null : current;
  }
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? JSON.parse(JSON.stringify(current))
      : {};
  for (const [key, newValue] of Object.entries(updated)) {
    if (!isMeaningful(newValue)) continue;
    if (
      base[key] != null &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key]) &&
      typeof newValue === "object" &&
      !Array.isArray(newValue)
    ) {
      base[key] = mergePreserving(base[key], newValue);
    } else {
      base[key] = newValue;
    }
  }
  return base;
}

function mergeProfilePreserving(currentProfile, updatedProfile) {
  return mergePreserving(currentProfile, updatedProfile);
}
export { mergeProfilePreserving };

function formatCoachInstructions(profile) {
  if (!profile || typeof profile !== "object") return "";
  const lines = [];
  const push = (label, value) => {
    if (typeof value === "string" && value.trim()) {
      lines.push(`- ${label}: ${value.trim()}`);
    } else if (value && typeof value === "object") {
      const text = JSON.stringify(value);
      if (text !== "{}") lines.push(`- ${label}: ${text}`);
    }
  };
  push("Comportamiento del entrenador", profile.trainer_behavior);
  push("Filosofía de entrenamiento", profile.filosofia);
  push("Análisis requerido", profile.analisis_requerido);
  return lines.join("\n");
}

function buildUserPrompt(comments, weeks, profile, metrics, equipment = null) {
  const sessions = getRecentSessions(4);

  const sessionsText = sessions.map(formatSessionForPrompt).join("\n");

  const today = format(new Date(), "yyyy-MM-dd");
  const todayStart = new Date(`${today}T00:00:00`);

  const currentWeek = computeCurrentWeek(getTenantId());
  const weekLabel = currentWeek != null ? `#${currentWeek}` : `#1`;

  const goals = getGoals(getTenantId());
  const primary = goals.find((g) => g.isPrimary) ?? goals[0];
  const secondary = goals.filter((g) => g !== primary).filter((g) => {
    if (!g.date) return false;
    const diff = differenceInCalendarDays(parseISO(g.date), todayStart);
    return diff >= 0 && diff <= 28;
  });
  const goalsText = [
    `OBJETIVO PRINCIPAL:`,
    primary ? `- ${primary.label} (${primary.date})` : "- (no hay objetivos definidos)",
    secondary.length > 0
      ? `\nOBJETIVOS SECUNDARIOS (dentro de las próximas 4 semanas):\n${secondary.map((g) => `- ${g.label} (${g.date})`).join("\n")}`
      : "",
  ].join("\n");

  const metricsLines = [];
  if (metrics?.running?.current) metricsLines.push(`- Running Z2 (últimas 8 semanas): ${metrics.running.current}`);
  if (metrics?.cycling?.current_power) metricsLines.push(`- Ciclismo (últimas 8 semanas): ${metrics.cycling.current_power}`);
  if (metrics?.swimming?.current_pace) metricsLines.push(`- Natación (últimas 8 semanas): ${metrics.swimming.current_pace}`);
  const metricsText =
    metricsLines.length > 0
      ? `\nÚLTIMOS DATOS OBTENIDOS (derivados de tus sesiones de las últimas 8 semanas):\n${metricsLines.join("\n")}\n`
      : "";

  const profileText =
    profile && Object.keys(profile).length > 0
      ? JSON.stringify(sanitizeProfile(profile), null, 2)
      : "(no hay perfil guardado)";

  const coachInstructions = formatCoachInstructions(profile);
  const coachText = coachInstructions
    ? `\nINSTRUCCIONES DEL ENTRENADOR (no forman parte del perfil del atleta; son directrices de comportamiento, filosofía y análisis a aplicar):\n${coachInstructions}\n`
    : "";

  const equipmentLine =
    Array.isArray(equipment) && equipment.length > 0
      ? equipment.join(", ")
      : equipment && equipment.length === 0
        ? "sin datos"
        : (() => {
            const all = getEquipmentLabels(getTenantId());
            if (all.length === 0 && Array.isArray(profile?.equipment)) {
              return profile.equipment.map(String).join(", ");
            }
            return all.length > 0 ? all.join(", ") : "sin datos";
          })();

  const focusSports = getFocusSports(getTenantId());
  const focusText =
    focusSports.length > 0
      ? focusSports.join(", ")
      : "running, cycling, swimming";

  return `
CONTEXTO ACTUAL:
- Hoy es: ${today}
- Semana actual de entrenamiento: ${weekLabel} (contadas desde el inicio del plan)
- El plan empieza HOY: ${today}. Programa las sesiones a partir de hoy (hoy incluido), no en el futuro ni esperando al lunes.
- Sesiones de las últimas 8 semanas (incluye las notas que escribió el atleta tras cada sesión):

${sessionsText}
${metricsText}
DEPORTES DE ENFOQUE:
${focusText}
El atleta quiere mejorar principalmente en los deportes anteriores: genera SIEMPRE sesiones de entrenamiento de esos deportes (distribuidas en la semana). Puede practicar otros deportes puntualmente (p.ej. fuerza, senderismo), pero el plan debe centrarse en los deportes de enfoque.
OBJETIVOS:
${goalsText}

PERFIL DEL ATLETA (JSON):
${profileText}
${coachText}
EQUIPAMIENTO DISPONIBLE:
${equipmentLine}

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

export async function generatePlan({ comments = "", weeks = 1, aiConfigId = null, promptId = null, equipment = null, settings, actor, planId = null }) {
  const tenantId = getTenantId();
  if (planId) updatePlanStatus(planId, "generating");

  const profile = getAthleteProfile() ?? {};

  const recentSessions = getRecentSessions(4);
  const metrics = deriveProfileMetrics(recentSessions);
  const updatedProfile = mergeProfileMetrics(profile, metrics);

  let titlesUpdated = [];
  try {
    titlesUpdated = await generateSessionTitles(recentSessions, settings, actor);
  } catch (err) {
    console.error("Error generando títulos de sesión:", err.message);
  }

  const prompt = promptId ? getPrompt(promptId) : null;
  const systemPrompt = prompt && prompt.tenant_id === tenantId
    ? `${prompt.content}\n\n${getFormatBlock(tenantId)}`
    : requireRolePrompt("system");

  let equipmentList = null;
  if (Array.isArray(equipment)) {
    const owned = new Set(getEquipmentLabels(tenantId));
    equipmentList = equipment.filter((it) => owned.has(String(it)));
  }

  const userPrompt = buildUserPrompt(comments, weeks, updatedProfile, metrics, equipmentList);

  try {
    const { text: responseText, responseId } = await callAiChat(
      settings,
      { systemPrompt, input: userPrompt },
      actor
    );

    const { comments: llmComments, sessions: rawSessions, updated_profile } = parseLLMResponse(responseText);

    let id = planId;
    if (id) {
      updatePlanResult(id, { comments: llmComments, responseId });
    } else {
      id = savePlan(tenantId, {
        comments: llmComments,
        weeks,
        aiConfigId,
        promptId,
        promptName: prompt?.name ?? null,
        responseId,
        status: "completed",
      });
    }

    const createdSessions = [];
    for (const rawSession of rawSessions) {
      try {
        const created = createPlannedSession(rawSession, id);
        createdSessions.push(created);
      } catch (err) {
        console.error("Error creando sesión planificada:", err.message);
      }
    }

    let profileUpdated = false;
    if (updated_profile && typeof updated_profile === "object") {
      const normalized = normalizeProfile(updated_profile);
      if (normalized) {
        const merged = sanitizeProfile(mergeProfilePreserving(getAthleteProfile() ?? {}, normalized));
        for (const key of ["trainer_behavior", "filosofia", "analisis_requerido"]) {
          if (profile[key] != null && merged[key] == null) merged[key] = profile[key];
        }
        const versionId = saveProfileVersion(tenantId, merged, "ai");
        if (versionId) {
          saveAthleteProfile(tenantId, merged);
          profileUpdated = true;
        }
      }
    }

    return {
      planId: id,
      comments: llmComments,
      sessions: createdSessions,
      titlesUpdated,
      profileUpdated,
    };
  } catch (err) {
    if (planId) updatePlanStatus(planId, "failed", err.message);
    throw new Error(`Error al generar el plan: ${err.message}`);
  }
}

function formatPlannedSessionForPrompt(session) {
  const date = session.start_date_local ? formatTrainingDayForPrompt(session.start_date_local) : "sin fecha";
  const status = session.merged_with ? "[COMPLETADA]" : "[PENDIENTE]";
  return `- ${date} | ${status} | ${session.sport} | ${session.title ?? session.name} | ${session.workout_text ?? ""}`.trim();
}

function formatCompletedSessionForPrompt(session) {
  const date = session.start_date_local ? formatTrainingDayForPrompt(session.start_date_local) : "sin fecha";
  const metrics = [
    session.distance_m != null ? `distancia=${Math.round(session.distance_m)}m` : null,
    session.time_s != null ? `tiempo=${Math.round(session.time_s)}s` : null,
    session.avg_pace_s_per_km != null ? `ritmo=${Math.round(session.avg_pace_s_per_km)}s/km` : null,
    session.avg_speed_ms != null ? `velocidad=${session.avg_speed_ms}m/s` : null,
    session.avg_heartrate != null ? `FC=${Math.round(session.avg_heartrate)}ppm` : null,
    session.avg_watts != null ? `potencia=${Math.round(session.avg_watts)}W` : null,
    session.rpe != null ? `RPE=${Math.round(session.rpe / 10)}/10` : null,
    session.feel != null ? `sensacion=${Math.round(session.feel / 10)}/10` : null,
  ].filter(Boolean).join(", ");
  const notes = session.notes?.trim() ? ` | notas: ${session.notes.trim()}` : "";
  return `- ${date} | ${session.sport} | ${session.title ?? session.name} | ${metrics || "sin métricas"}${notes}`;
}

export function buildChatUserPrompt(planId, message, options = {}) {
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  const planText =
    planned.length > 0
      ? planned.map(formatPlannedSessionForPrompt).join("\n")
      : "(no hay sesiones planificadas para este plan)";
  const cutoff = format(subWeeks(new Date(), 4), "yyyy-MM-dd");
  const completed = loadCompletedSessionsSince(cutoff);
  const completedText = completed.length > 0
    ? completed.map(formatCompletedSessionForPrompt).join("\n")
    : "(no hay actividades realizadas en las últimas 4 semanas)";
  const profile = getAthleteProfile();
  const profileText =
    profile && Object.keys(profile).length > 0
      ? JSON.stringify(sanitizeProfile(profile), null, 2)
      : "(no hay perfil guardado)";

  const coachInstructions = formatCoachInstructions(profile);
  const coachText = coachInstructions
    ? `\nINSTRUCCIONES DEL ENTRENADOR (no forman parte del perfil del atleta; son directrices de comportamiento, filosofía y análisis a aplicar):\n${coachInstructions}\n`
    : "";

  let equipment = getEquipmentLabels(getTenantId());
  if (equipment.length === 0 && Array.isArray(profile?.equipment)) {
    equipment = profile.equipment.map(String);
  }
  const equipmentLine = equipment.length > 0 ? equipment.join(", ") : "sin datos";

  const focusSports = getFocusSports(getTenantId());
  const focusText = focusSports.length > 0 ? focusSports.join(", ") : "running, cycling, swimming";

  const today = formatTrainingDayForPrompt(new Date().toISOString());

  let historyText = "";
  if (options.includeHistory) {
    const messages = listPlanMessages(planId);
    historyText =
      messages.length > 0
        ? `\nHISTORIAL DE LA CONVERSACIÓN (preguntas y respuestas anteriores del chat con este plan):\n${messages
            .map((m) => `${m.role === "user" ? "Atleta" : "Entrenador"}: ${m.content}`)
            .join("\n")}\n`
        : "";
  }

  return `
Hoy es: ${today}

PERFIL DEL ATLETA (JSON):
${profileText}
${coachText}
EQUIPAMIENTO DISPONIBLE:
${equipmentLine}

DEPORTES DE ENFOQUE:
${focusText}
El atleta quiere mejorar principalmente en estos deportes; el plan y tus propuestas deben centrarse en ellos (puede haber otros deportes puntuales).

PLAN ACTUAL (sesiones planeadas de este plan; [COMPLETADA] = ya realizada y fusionada con la actividad real, [PENDIENTE] = aún por hacer):
${planText}

ACTIVIDADES REALIZADAS — ÚLTIMAS 4 SEMANAS (incluyen las fusionadas con sesiones planeadas de este plan y cualquier otra actividad registrada):
${completedText}
${historyText}
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

// Huella del contexto que se le envía al entrenador: perfil del atleta,
// configuración relevante, equipamiento, sesiones del plan (con estado de
// merge) y actividades completadas de las últimas 4 semanas. Si nada de esto
// cambia, el contexto que ya conoce el proveedor sigue siendo válido y el chat
// puede reutilizar el hilo anterior enviando solo el mensaje nuevo.
export function computeContextHash(planId) {
  const profile = getAthleteProfile();
  const settings = getTenantSettings();
  const planned = loadPlannedSessions().filter((s) => s.plan_id === planId);
  const cutoff = format(subWeeks(new Date(), 4), "yyyy-MM-dd");
  const completed = loadCompletedSessionsSince(cutoff);
  const state = {
    today: format(new Date(), "yyyy-MM-dd"),
    profile: sanitizeProfile(profile),
    settings: {
      focusSports: getFocusSports(getTenantId()),
      planStart: settings?.plan_start ?? null,
      goalDate: settings?.goal_date ?? null,
      trainingWeekOneStart: settings?.training_week_one_start ?? null,
    },
    equipment: getEquipmentLabels(getTenantId()),
    planned: planned.map((s) => ({
      id: s.id,
      date: (s.start_date_local ?? "").slice(0, 10),
      sport: s.sport,
      title: s.title ?? s.name,
      merged: Boolean(s.merged_with),
    })),
    completed: completed.map((s) => ({
      id: s.id,
      date: (s.start_date_local ?? "").slice(0, 10),
      sport: s.sport,
      title: s.title ?? s.name,
      time_s: s.time_s ?? null,
      distance_m: s.distance_m ?? null,
      avg_heartrate: s.avg_heartrate ?? null,
      avg_watts: s.avg_watts ?? null,
      notes: s.notes ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export async function chatWithPlan({ planId, message, previousResponseId, settings, actor }) {
  const tenantId = getTenantId();
  const systemPrompt = requireRolePrompt("chat");

  // El contexto completo (perfil, plan, actividades recientes) solo se reenvía
  // cuando cambia de verdad: nueva actividad realizada, perfil editado, plan
  // modificado o día nuevo. Si no ha cambiado y el proveedor mantiene hilo
  // (opencode con sesión por atleta/plan, gemini con previous_interaction_id),
  // se reutiliza la interacción anterior enviando SOLO el mensaje nuevo. El
  // mock no mantiene un hilo real, así que siempre recibe el contexto completo.
  const currentHash = computeContextHash(planId);
  const plan = getPlan(tenantId, planId);
  const contextChanged = currentHash !== plan?.contextHash;

  const threaded =
    settings?.provider !== "mock" && Boolean(previousResponseId) && !contextChanged;

  let text;
  let responseId;

  if (threaded) {
    try {
      ({ text, responseId } = await callAiChat(
        settings,
        { systemPrompt, input: message, previousResponseId },
        actor
      ));
    } catch (err) {
      // La interacción anterior caducó (gemini devuelve error por un
      // previous_interaction_id no válido; opencode perdió la sesión) o el
      // proveedor no puede seguir el hilo: se arranca una interacción nueva
      // enviando TODO el contexto y el historial, sin depender de la sesión.
      const fullPrompt = buildChatUserPrompt(planId, message, { includeHistory: true });
      ({ text, responseId } = await callAiChat(
        settings,
        { systemPrompt, input: fullPrompt, previousResponseId: null },
        actor
      ));
      updatePlanContextHash(planId, currentHash);
    }
  } else {
    // Primera pregunta de la conversación, hilo no soportado o contexto
    // cambiado: se envía el contexto completo actualizado y se arranca un hilo
    // nuevo (el hilo anterior, si existe, tiene contexto desactualizado).
    const fullPrompt = buildChatUserPrompt(planId, message, { includeHistory: true });
    ({ text, responseId } = await callAiChat(
      settings,
      { systemPrompt, input: fullPrompt, previousResponseId: null },
      actor
    ));
    updatePlanContextHash(planId, currentHash);
  }

  const parsed = parseChatResponse(text);
  const reply = parsed.reply || text;

  addPlanMessage(planId, "assistant", reply);

  let sessionsUpdated = [];
  if (parsed.sessions.length > 0) {
    sessionsUpdated = replacePlanSessions(planId, parsed.sessions);
  }

  return { reply, sessionsUpdated, responseId, tenantId };
}
