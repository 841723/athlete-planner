import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db.js";
import { getTenantId, upsertSession } from "./sessions.js";
import { saveTrack, existingTrackIds } from "./track.js";
import { mergePlannedWithCompleted } from "./merge.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const GARMIN_FETCH = path.join(SCRIPTS_DIR, "garmin-fetch.py");
const SYNC_SESSIONS = path.join(SCRIPTS_DIR, "sync-sessions.mjs");

const MIN_DATE = process.env.MIN_DATE ?? "2026-05-12";
const GARMIN_DEPS = "garminconnect==0.3.8";
const PYTHON_VERSION = "3.12";

let syncing = false;

function run(cmd, args, { cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else {
        const err = new Error(stderr.trim() || `El comando ${cmd} terminó con código ${code}`);
        err.exitCode = code;
        err.stderr = stderr.trim();
        reject(err);
      }
    });
  });
}

function runPython(args) {
  return run("uv", ["run", "--python", PYTHON_VERSION, "--with", GARMIN_DEPS, "python", GARMIN_FETCH, ...args]);
}

function runNode(script, args) {
  return run("node", [script, ...args]);
}

function existingIds() {
  const rows = getDb()
    .prepare("SELECT id FROM sessions WHERE tenant_id = ? AND kind = 'completed'")
    .all(getTenantId());
  return new Set(rows.map((r) => String(r.id)));
}

async function fetchAllIds() {
  const out = await runPython(["ids", "--min-date", MIN_DATE, "--json"]);
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

export async function runSync({ force = false, backfillTracks = false } = {}) {
  if (syncing) {
    const err = new Error("Ya hay una sincronización en curso");
    err.status = 409;
    throw err;
  }
  syncing = true;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-sync-"));
  const listFile = path.join(workDir, "raw-activities.json");
  const detailsDir = path.join(workDir, "details");
  const sessionsDir = path.join(workDir, "sessions");
  const tracksDir = path.join(workDir, "tracks");
  try {
    fs.mkdirSync(detailsDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(tracksDir, { recursive: true });

    const allIds = await fetchAllIds();
    const existing = existingIds();
    const missingIds = allIds.filter((id) => !existing.has(id));

    const withTrack = existingTrackIds(getTenantId());
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
      await runPython(["list", "--min-date", MIN_DATE, "--out", listFile]);
      for (const id of missingIds) {
        await runPython(["details", id, "--list", listFile, "--out", path.join(detailsDir, `${id}.json`)]);
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
      await runPython(["track", id, "--out", path.join(tracksDir, `${id}.json`)]);
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
        "No se pudo autenticar con Garmin. Vuelve a iniciar sesión: docker compose exec app uvx garmin-connect-mcp auth"
      );
      friendly.status = 500;
      throw friendly;
    }
    throw err;
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignorar */
    }
    syncing = false;
  }
}
