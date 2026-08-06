#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const idsOnly = new Set();
for (const a of args) {
  if (a.startsWith("--ids=")) {
    for (const id of a.slice("--ids=".length).split(",")) {
      if (id) idsOnly.add(String(id));
    }
  }
}
const rest = args.filter((a) => a !== "--force" && !a.startsWith("--ids="));

// Solo se sincronizan entrenamientos desde esta fecha (inclusive).
const MIN_DATE = "2026-05-12";

const [listPath, detailsDir, sessionsDir = "sessions"] = rest;
if (!listPath || !detailsDir) {
  console.error("Uso: node scripts/sync-sessions.mjs <list.json> <detailsDir> [sessionsDir] [--force] [--ids=id1,id2]");
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
const activities = list.data?.activities ?? [];
if (!activities.length) {
  console.error("No se encontraron actividades en el listado.");
  process.exit(1);
}

const details = new Map();
if (fs.existsSync(detailsDir)) {
  for (const file of fs.readdirSync(detailsDir)) {
    const m = file.match(/^(\d+)\.json$/);
    if (!m) continue;
    try {
      details.set(m[1], JSON.parse(fs.readFileSync(path.join(detailsDir, file), "utf8")));
    } catch {
      console.error(`Ignorando detalle inválido: ${file}`);
    }
  }
}

fs.mkdirSync(sessionsDir, { recursive: true });
const existing = new Set();
for (const file of fs.readdirSync(sessionsDir)) {
  const m = file.match(/-(\d+)-/);
  if (m) existing.add(m[1]);
}

const slugify = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "actividad";

const num = (v) => (Number.isFinite(v) ? v : undefined);
const round = (v, d = 0) => (v === undefined ? undefined : Math.round(v * 10 ** d) / 10 ** d);
const pacePerKm = (speedMs) => (speedMs > 0 ? Math.round(1000 / speedMs) : undefined);

const BEST_EFFORT_KEYS = [
  ["fastestSplit_1000", "1K", 1000],
  ["fastestSplit_1609", "1 Mile", 1609],
  ["fastestSplit_5000", "5K", 5000],
  ["fastestSplit_10000", "10K", 10000],
];

function summary(a) {
  const s = {
    schema_version: 4,
    id: String(a.activityId),
    sport: a.activityType?.typeKey,
    name: a.activityName,
  };
  const start = a.startTimeLocal?.datetime?.replace(" ", "T") ?? null;
  if (start) s.start_date_local = start;
  const distance = num(a.distance?.meters);
  if (distance) s.distance_m = round(distance, 2);
  const moving = num(a.movingDuration);
  const elapsed = num(a.elapsedDuration);
  if (moving) s.moving_time_s = Math.round(moving);
  if (elapsed) s.elapsed_time_s = Math.round(elapsed);
  const avgSpeed = num(a.averageSpeed?.mps);
  const maxSpeed = num(a.maxSpeed);
  if (avgSpeed) {
    s.avg_speed_ms = round(avgSpeed, 3);
    const pace = pacePerKm(avgSpeed);
    if (pace !== undefined) s.avg_pace_s_per_km = pace;
  }
  if (maxSpeed) s.max_speed_ms = round(maxSpeed, 3);
  const avgHr = num(a.averageHR);
  const maxHr = num(a.maxHR);
  if (avgHr) s.avg_heartrate = Math.round(avgHr);
  if (maxHr) s.max_heartrate = Math.round(maxHr);
  const avgW = num(a.avgPower);
  const maxW = num(a.maxPower);
  if (avgW) s.avg_watts = Math.round(avgW);
  if (maxW) s.max_watts = Math.round(maxW);
  const elev = num(a.elevationGain?.meters);
  if (elev) s.total_elevation_gain_m = Math.round(elev);
  const elevLoss = num(a.elevationLoss);
  if (elevLoss) s.total_elevation_loss_m = Math.round(elevLoss);
  const tMin = num(a.minTemperature);
  const tMax = num(a.maxTemperature);
  if (tMin !== undefined && tMax !== undefined) s.average_temp_c = round((tMin + tMax) / 2, 1);
  const te = num(a.aerobicTrainingEffect);
  if (te) s.training_effect = round(te, 1);
  const cal = num(a.calories);
  if (cal) s.calories_kcal = Math.round(cal);
  const notes = a.notes || a.description || null;
  if (notes && typeof notes === "string" && notes.trim()) {
    s.notes = notes.trim();
  }
  const locationName = a.locationName || a.locationNameFull || null;
  if (locationName && typeof locationName === "string" && locationName.trim()) {
    s.location_name = locationName.trim();
  }
  return s;
}

function bestEfforts(a) {
  const best = [];
  for (const [key, name, dist] of BEST_EFFORT_KEYS) {
    if (Number.isFinite(a[key])) best.push({ name, distance_m: dist, elapsed_time_s: Math.round(a[key]) });
  }
  return best;
}

function selfEvaluation(d) {
  const summaryDto =
    d?.data?.activity?.summaryDTO ??
    d?.data?.summaryDTO ??
    d?.data?.activity?.metadataDTO ??
    {};
  const rpe = num(summaryDto.directWorkoutRpe);
  const feel = num(summaryDto.directWorkoutFeel);
  const result = {};
  if (rpe !== undefined) result.rpe = Math.round(rpe);
  if (feel !== undefined) result.feel = Math.round(feel);
  return Object.keys(result).length ? result : undefined;
}

function segments(d) {
  const laps = d?.data?.splits?.lapDTOs ?? [];
  const segs = [];
  for (const lap of laps) {
    const distance = num(lap.distance);
    if (!distance) continue;
    const seg = {};
    seg.distance_m = round(distance, 2);
    const dur = num(lap.duration);
    if (dur) seg.time_s = Math.round(dur);
    const speed = num(lap.averageSpeed);
    if (speed) {
      seg.avg_speed_ms = round(speed, 3);
      const pace = pacePerKm(speed);
      if (pace !== undefined) seg.avg_pace_s_per_km = pace;
    }
    const maxSpeed = num(lap.maxSpeed);
    if (maxSpeed) seg.max_speed_ms = round(maxSpeed, 3);
    const avgHr = num(lap.averageHR);
    const maxHr = num(lap.maxHR);
    if (avgHr) seg.avg_heartrate = Math.round(avgHr);
    if (maxHr) seg.max_heartrate = Math.round(maxHr);
    const avgW = num(lap.averagePower);
    const maxW = num(lap.maxPower);
    if (avgW) seg.avg_watts = Math.round(avgW);
    if (maxW) seg.max_watts = Math.round(maxW);
    const elev = num(lap.elevationGain);
    if (elev) seg.total_elevation_gain_m = Math.round(elev);
    const elevLoss = num(lap.elevationLoss);
    if (elevLoss) seg.total_elevation_loss_m = Math.round(elevLoss);
    if (lap.intensityType) seg.intensity = lap.intensityType;
    segs.push(seg);
  }
  return segs;
}

function hrZones(d) {  const zones = d?.data?.hr_zones ?? [];
  if (!zones.length) return undefined;
  return zones.map((z) => ({
    zoneNumber: z.zoneNumber,
    zoneLowBoundary: z.zoneLowBoundary,
    secsInZone: Math.round(z.secsInZone ?? 0),
  }));
}

let written = 0;
let skipped = 0;
let missing = 0;
let filtered = 0;
for (const a of activities) {
  const id = String(a.activityId);
  const startDate = (a.startTimeLocal?.datetime ?? "").slice(0, 10);
  if (startDate < MIN_DATE) {
    filtered++;
    continue;
  }
  if (idsOnly.size && !idsOnly.has(id)) {
    skipped++;
    continue;
  }
  if (!force && existing.has(id)) {
    skipped++;
    continue;
  }
  const session = summary(a);
  const d = details.get(id);
  session.segments = segments(d);
  session.best_efforts = bestEfforts(a);
  const zones = hrZones(d);
  if (zones) session.hr_zones = zones;
  const self = selfEvaluation(d);
  if (self) Object.assign(session, self);
  const date = (session.start_date_local ?? "").slice(0, 10).replace(/-/g, "") || "sinfecha";
  const file = path.join(sessionsDir, `${date}-${id}-${slugify(session.name)}.json`);
  if (force && fs.existsSync(file)) {
    try {
      const old = JSON.parse(fs.readFileSync(file, "utf8"));
      if (old.title) session.title = old.title;
    } catch {
      /* ignorar archivo previo inválido */
    }
  }
  fs.writeFileSync(file, JSON.stringify(session, null, 2) + "\n");
  written++;
  if (!details.has(id)) missing++;
}
console.log(`Sincronizadas: ${written} | Omitidas: ${skipped} | Filtradas (antes de ${MIN_DATE}): ${filtered} | Sin detalles (sin segmentos): ${missing} | Total: ${activities.length}`);
