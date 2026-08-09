import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db.js";
import { getTenantId, upsertSession } from "./sessions.js";
import { saveTrack, existingTrackIds } from "./track.js";
import { mergePlannedWithCompleted } from "./merge.js";
import { runPython, runNode, GARMIN_FETCH, SYNC_SESSIONS } from "./sync-run.js";
import { getSyncSource, getSyncTokensRaw } from "./sync-sources.js";
import { syncStrava } from "./strava.js";

const MIN_DATE = process.env.MIN_DATE ?? "2026-05-12";

let syncing = false;

function existingIds() {
  const rows = getDb()
    .prepare("SELECT id FROM sessions WHERE tenant_id = ? AND kind = 'completed'")
    .all(getTenantId());
  return new Set(rows.map((r) => String(r.id)));
}

async function fetchAllIds(tokensFile) {
  const out = await runPython(GARMIN_FETCH, ["ids", "--min-date", MIN_DATE, "--tokens", tokensFile, "--json"]);
  return JSON.parse(out || "[]").map(String);
}

function parseSummary(line) {
  const m = line.match(/Sincronizadas:\s*(\d+).*Omitidas:\s*(\d+).*Filtradas.*?(\d+).*Sin detalles.*?(\d+)/);
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
      if (!session?.id) continue;
      upsertSession(getTenantId(), "completed", session);
      imported++;
    } catch {
      /* ignorar JSON inválido */
    }
  }
  return imported;
}

function importTracks(dir, ids) {
  let imported = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const m = file.match(/^(\d+)\.json$/);
    if (!m || !ids.includes(m[1])) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      saveTrack(getTenantId(), m[1], data);
      imported++;
    } catch {
      /* ignorar track inválido */
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
  const rawTokens = getSyncTokensRaw(tenantId, "garmin");
  if (!rawTokens) {
    const err = new Error("No hay tokens de Garmin para este atleta");
    err.status = 400;
    throw err;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-sync-"));
  const tokensFile = path.join(workDir, "tokens.json");
  const listFile = path.join(workDir, "raw-activities.json");
  const detailsDir = path.join(workDir, "details");
  const sessionsDir = path.join(workDir, "sessions");
  const tracksDir = path.join(workDir, "tracks");
  try {
    fs.writeFileSync(tokensFile, rawTokens);
    fs.mkdirSync(detailsDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(tracksDir, { recursive: true });

    const allIds = await fetchAllIds(tokensFile);
    const existing = existingIds();
    const missingIds = allIds.filter((id) => !existing.has(id));

    const withTrack = existingTrackIds(tenantId);
    const trackIds = allIds.filter((id) => !withTrack.has(id));

    if (!missingIds.length && !trackIds.length) {
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
      await runPython(GARMIN_FETCH, ["list", "--min-date", MIN_DATE, "--tokens", tokensFile, "--out", listFile]);
      for (const id of missingIds) {
        await runPython(GARMIN_FETCH, ["details", id, "--list", listFile, "--tokens", tokensFile, "--out", path.join(detailsDir, `${id}.json`)]);
      }
    }

    let syncOut = "";
    let imported = 0;
    if (missingIds.length) {
      const syncArgs = [listFile, detailsDir, sessionsDir, `--ids=${missingIds.join(",")}`];
      if (force) syncArgs.push("--force");
      syncOut = await runNode(SYNC_SESSIONS, syncArgs);
      imported = importNormalizedSessions(sessionsDir, missingIds);
    }

    for (const id of trackIds) {
      await runPython(GARMIN_FETCH, ["track", id, "--tokens", tokensFile, "--out", path.join(tracksDir, `${id}.json`)]);
    }
    const trackCount = importTracks(tracksDir, trackIds);

    const merged = mergePlannedWithCompleted();

    return {
      ...(syncOut
        ? (parseSummary(syncOut) ?? { synced: imported, skipped: 0, filtered: 0, missing: 0 })
        : { synced: 0, skipped: 0, filtered: 0, missing: 0 }),
      ids: missingIds,
      tracks: trackCount,
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

export async function runSync({ force = false, backfillTracks = false } = {}) {
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
