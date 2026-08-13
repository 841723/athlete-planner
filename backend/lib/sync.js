import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db.js";
import { getTenantId, getTenantSettings, upsertExternalSession } from "./sessions.js";
import { mergePlannedWithCompleted } from "./merge.js";
import { runPython, runNode, GARMIN_FETCH, SYNC_SESSIONS } from "./sync-run.js";
import { getSyncSource, getSyncTokensRaw } from "./sync-sources.js";
import { syncStrava } from "./strava.js";

let syncing = false;

// El rango de sincronización sale del propio atleta, nunca de una fecha
// hardcodeada: primero el rango configurado en la fuente (config.min_date),
// luego MIN_DATE de entorno, luego la sesión más antigua que ya tiene el
// atleta (así el fetch de Garmin queda acotado a su historial real).
function effectiveMinDate(config) {
  if (config.min_date) return config.min_date;
  if (process.env.MIN_DATE) return process.env.MIN_DATE;
  const oldest = getDb()
    .prepare("SELECT MIN(json_extract(data, '$.start_date_local')) AS d FROM sessions WHERE tenant_id = ?")
    .get(getTenantId())?.d;
  if (oldest) return String(oldest).slice(0, 10);
  return getTenantSettings(getTenantId())?.min_date ?? null;
}

function existingIds() {
  const rows = getDb()
    .prepare("SELECT external_activity_id FROM activity_sources WHERE tenant_id = ? AND source = 'garmin'")
    .all(getTenantId());
  return new Set(rows.map((r) => String(r.external_activity_id)));
}

async function fetchAllIds(tokensFile, dateArgs = []) {
  const out = await runPython(GARMIN_FETCH, ["ids", "--tokens", tokensFile, "--json", ...dateArgs]);
  return JSON.parse(out || "[]").map(String);
}

function parseSummary(line) {
  const m = line.match(/Sincronizadas:\s*(\d+).*?Omitidas:\s*(\d+).*?Filtradas:\s*(\d+).*?Sin detalles:\s*(\d+)/);
  if (!m) return null;
  return {
    synced: Number(m[1]),
    skipped: Number(m[2]),
    filtered: Number(m[3]),
    missing: Number(m[4]),
  };
}

function importNormalizedSessions(dir, ids) {
  let imported = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const m = file.match(/-(\d+)-/);
    if (!m || !ids.includes(m[1])) continue;
    try {
      const session = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const externalId = m[1] ?? session?.external_id ?? session?.id;
      if (!externalId || !session) continue;
      upsertExternalSession(getTenantId(), "garmin", externalId, session);
      imported++;
    } catch {
      /* ignorar JSON inválido */
    }
  }
  return imported;
}

function connectedSource() {
  const tenantId = getTenantId();
  const garmin = getSyncSource(tenantId, "garmin");
  const strava = getSyncSource(tenantId, "strava");
  if (garmin?.status === "connected" && garmin.tokens) return "garmin";
  if (strava?.status === "connected" && strava.tokens) return "strava";
  return null;
}

async function syncGarmin({ force = false }) {
  const tenantId = getTenantId();
  const source = getSyncSource(tenantId, "garmin");
  const rawTokens = getSyncTokensRaw(tenantId, "garmin");
  if (!rawTokens) {
    const err = new Error("No hay tokens de Garmin para este atleta");
    err.status = 400;
    throw err;
  }

  const config = JSON.parse(source?.config ?? "{}") ?? {};
  const minDate = effectiveMinDate(config);
  const maxDate = config.max_date ?? null;

  const dateArgs = [];
  if (minDate) dateArgs.push("--min-date", minDate);
  if (maxDate) dateArgs.push("--max-date", maxDate);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-sync-"));
  const tokensFile = path.join(workDir, "tokens.json");
  const listFile = path.join(workDir, "raw-activities.json");
  const detailsDir = path.join(workDir, "details");
  const sessionsDir = path.join(workDir, "sessions");
  try {
    fs.writeFileSync(tokensFile, rawTokens);
    fs.mkdirSync(detailsDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    const allIds = await fetchAllIds(tokensFile, dateArgs);
    const existing = existingIds();
    const missingIds = allIds.filter((id) => !existing.has(id));

    if (!missingIds.length) {
      return {
        synced: 0,
        skipped: allIds.length,
        filtered: 0,
        missing: 0,
        ids: [],
        message: "No hay sesiones nuevas que sincronizar",
      };
    }

    if (missingIds.length) {
      await runPython(GARMIN_FETCH, ["list", "--tokens", tokensFile, "--out", listFile, ...dateArgs]);
      for (const id of missingIds) {
        await runPython(GARMIN_FETCH, ["details", id, "--list", listFile, "--tokens", tokensFile, "--out", path.join(detailsDir, `${id}.json`)]);
      }
    }

    let syncOut = "";
    let imported = 0;
    if (missingIds.length) {
      const syncArgs = [listFile, detailsDir, sessionsDir, `--ids=${missingIds.join(",")}`];
      if (minDate) syncArgs.push("--min-date", minDate);
      if (maxDate) syncArgs.push("--max-date", maxDate);
      if (force) syncArgs.push("--force");
      syncOut = await runNode(SYNC_SESSIONS, syncArgs);
      imported = importNormalizedSessions(sessionsDir, missingIds);
    }

    const merged = mergePlannedWithCompleted();

    return {
      ...(syncOut
        ? (parseSummary(syncOut) ?? { synced: imported, skipped: 0, filtered: 0, missing: 0 })
        : { synced: 0, skipped: 0, filtered: 0, missing: 0 }),
      ids: missingIds,
      merged,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignorar */
    }
  }
}

export async function runSync({ force = false } = {}) {
  if (syncing) {
    const err = new Error("Ya hay una sincronización en curso");
    err.status = 409;
    throw err;
  }
  syncing = true;
  try {
    const tenantId = getTenantId();
    const source = connectedSource();

    if (!source) {
      const err = new Error(
        "No hay ninguna fuente de actividades conectada. Conéctala en Configuración → Sincronización."
      );
      err.status = 400;
      throw err;
    }

    if (source === "strava") {
      const stravaSource = getSyncSource(tenantId, "strava");
      const tokens = JSON.parse(stravaSource.tokens);
      const result = await syncStrava(tenantId, { tokens, config: JSON.parse(stravaSource.config ?? "{}") });
      return { source, ...result };
    }

    return { source: "garmin", ...(await syncGarmin({ force })) };
  } catch (err) {
    const message = err?.message ?? String(err);
    if (err?.code === "ENOENT" || err?.code === "EACCES") {
      const friendly = new Error(
        "No se pudo ejecutar uv. Asegúrate de que está instalado en el contenedor (Dockerfile) o en el host."
      );
      friendly.status = 500;
      throw friendly;
    }
    const stderr = err?.stderr ?? "";
    if (/login|token|auth|oauth|session|401|403/i.test(message) && /garminconnect|garmin_connect/i.test(stderr)) {
      const friendly = new Error(
        "No se pudo autenticar con Garmin. Reconecta tu cuenta en Configuración → Sincronización."
      );
      friendly.status = 500;
      throw friendly;
    }
    throw err;
  } finally {
    syncing = false;
  }
}
