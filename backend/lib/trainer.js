import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import {
  getAthleteProfile,
  getSportCategory,
  getTenantId,
  loadCompletedSessions,
  enrich,
  saveAthleteProfile,
  upsertSession,
  updateSession,
} from "./sessions.js";
import { buildObjectives } from "./objectives.js";
import { subWeeks, format, parseISO, startOfWeek } from "date-fns";

const execAsync = promisify(exec);

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

async function runLLM(fullPrompt) {
  const { stdout, stderr } = await execAsync(
    `opencode run --format json --dir "${path.resolve(import.meta.dirname, "..", "..")}"`,
    {
      input: fullPrompt,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: "0" },
    }
  );

  let responseText = stdout;
  if (!responseText || responseText.trim().length === 0) {
    responseText = stderr;
  }
  return responseText;
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

async function generateSessionTitles(sessions) {
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

  const responseText = await runLLM(`${systemPrompt}\n\n---\n\n${userPrompt}`);
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
  const updated = { ...profile };
  if (metrics.running) {
    updated.strengths = {
      ...(updated.strengths ?? {}),
      running: { ...(updated.strengths?.running ?? {}), ...metrics.running },
    };
  }
  if (metrics.cycling) {
    updated.weaknesses = {
      ...(updated.weaknesses ?? {}),
      cycling: { ...(updated.weaknesses?.cycling ?? {}), ...metrics.cycling },
    };
  }
  if (metrics.swimming) {
    updated.weaknesses = {
      ...(updated.weaknesses ?? {}),
      swimming: { ...(updated.weaknesses?.swimming ?? {}), ...metrics.swimming },
    };
  }
  if (metrics.goal) {
    updated.goal = { ...(updated.goal ?? {}), ...metrics.goal };
  }
  return updated;
}

function buildUserPrompt(comments, weeks, profile, metrics) {
  const sessions = getRecentSessions(8);

  const sessionsText = sessions.map(formatSessionForPrompt).join("\n");

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const targetWeekStart = subWeeks(weekStart, -weeks);
  const targetDate = format(targetWeekStart, "yyyy-MM-dd");

  const currentWeek = profile.goal?.current_week ?? null;
  const weekLabel = currentWeek != null ? `#${currentWeek + weeks}` : `+${weeks}`;

  const metricsLines = [];
  if (metrics?.goal?.current_week) metricsLines.push(`- Semana actual de entrenamiento: #${metrics.goal.current_week}`);
  if (metrics?.running?.current) metricsLines.push(`- Running Z2 (últimas 8 semanas): ${metrics.running.current}`);
  if (metrics?.cycling?.current_power) metricsLines.push(`- Ciclismo (últimas 8 semanas): ${metrics.cycling.current_power}`);
  if (metrics?.swimming?.current_pace) metricsLines.push(`- Natación (últimas 8 semanas): ${metrics.swimming.current_pace}`);
  const metricsText =
    metricsLines.length > 0
      ? `\nÚLTIMOS DATOS OBTENIDOS (derivados de tus sesiones de las últimas 8 semanas):\n${metricsLines.join("\n")}\n`
      : "";

  return `
CONTEXTO ACTUAL:
- Semana actual de entrenamiento: ${weekLabel}
- Fecha objetivo: ${targetDate}
- Sesiones de las últimas 8 semanas (incluye las notas que escribió el atleta tras cada sesión):

${sessionsText}
${metricsText}
COMENTARIOS DEL ATLETA:
${comments}

Genera un plan de entrenamiento para las próximas ${weeks} semana(s). Responde con el JSON estructurado como se indica en las instrucciones.
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

function createPlannedSession(sessionData) {
  const session = {
    schema_version: 2,
    id: randomUUID(),
    sport: sessionData.sport,
    title: sessionData.title,
    name: sessionData.name ?? sessionData.title,
    start_date_local: sessionData.start_date_local,
    distance_m: sessionData.distance_m,
    moving_time_s: sessionData.moving_time_s ?? sessionData.elapsed_time_s,
    elapsed_time_s: sessionData.elapsed_time_s ?? sessionData.moving_time_s,
    avg_pace_s_per_km: sessionData.avg_pace_s_per_km,
    avg_speed_ms: sessionData.avg_speed_ms,
    hr_from: sessionData.hr_from,
    hr_to: sessionData.hr_to,
    workout: sessionData.workout,
  };

  upsertSession(getTenantId(), "planned", session);
  return { ...enrich(session), objectives: buildObjectives(session) };
}

function clearPlannedSessions() {
  getDb().prepare("DELETE FROM sessions WHERE tenant_id = ? AND kind = 'planned'").run(getTenantId());
}

export async function generatePlan(comments, weeks = 1) {
  const systemPrompt = loadSystemPrompt();
  const profile = getAthleteProfile() ?? {};
  const recentSessions = getRecentSessions(8);
  const metrics = deriveProfileMetrics(recentSessions);
  const updatedProfile = mergeProfileMetrics(profile, metrics);
  if (Object.keys(metrics).length > 0) {
    saveAthleteProfile(getTenantId(), updatedProfile);
  }
  let titlesUpdated = [];
  try {
    titlesUpdated = await generateSessionTitles(recentSessions);
  } catch (err) {
    console.error("Error generando títulos de sesión:", err.message);
  }
  const userPrompt = buildUserPrompt(comments, weeks, updatedProfile, metrics);

  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  try {
    const responseText = await runLLM(fullPrompt);

    const { comments: llmComments, sessions: rawSessions } = parseLLMResponse(responseText);

    clearPlannedSessions();

    const createdSessions = [];
    for (const rawSession of rawSessions) {
      try {
        const created = createPlannedSession(rawSession);
        createdSessions.push(created);
      } catch (err) {
        console.error("Error creando sesión planificada:", err.message);
      }
    }

    return {
      comments: llmComments,
      sessions: createdSessions,
      titlesUpdated,
    };
  } catch (err) {
    if (err.killed) {
      throw new Error("La generación del plan tomó demasiado tiempo. Intenta con menos semanas.");
    }
    throw new Error(`Error al generar el plan: ${err.message}`);
  }
}
