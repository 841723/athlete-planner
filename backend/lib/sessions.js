import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { differenceInDays, parseISO, startOfWeek } from "date-fns";
import { getDb } from "./db.js";

export const tenantContext = new AsyncLocalStorage();

export function withTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}

export function getTenantId() {
  return tenantContext.getStore()?.tenantId ?? null;
}

export const SPORT_CATEGORIES = {
  running: "running",
  trail_running: "running",
  cycling: "cycling",
  virtual_ride: "cycling",
  indoor_cycling: "cycling",
  swimming: "swimming",
  lap_swimming: "swimming",
  open_water_swimming: "swimming",
  strength_training: "strength",
  hiking: "hiking",
  walking: "walking",
  paddelball: "padel",
  other: "other",
  breathwork: "other",
  assistance: "other",
  resort_skiing: "other",
  tennis_v2: "other",
  elliptical: "other",
};

export const RACKET_SPORTS = new Set(["paddelball", "tennis_v2"]);
export const ELAPSED_TIME_SPORTS = new Set(["hiking", "walking"]);

export const TRAINING_WEEK_ONE_START = "2026-05-11";

export function getSportCategory(sport) {
  return SPORT_CATEGORIES[sport] ?? "other";
}

export function getSessionTime(s) {
  const racket = RACKET_SPORTS.has(s.sport);
  const useElapsed = ELAPSED_TIME_SPORTS.has(s.sport);
  if (racket || useElapsed) {
    return s.elapsed_time_s ?? s.moving_time_s ?? 0;
  }
  return s.moving_time_s ?? s.elapsed_time_s ?? 0;
}

export function getTenantSettings(tenantId = getTenantId()) {
  if (!tenantId) return {};
  const store = tenantContext.getStore();
  if (store?.settings) return store.settings;
  const row = getDb()
    .prepare("SELECT * FROM tenant_settings WHERE tenant_id = ?")
    .get(tenantId);
  const settings = row ?? {};
  if (store) store.settings = settings;
  return settings;
}

export function getWeekNumber(date, weekOneStart) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const anchor = parseISO(
    weekOneStart ?? getTenantSettings()?.training_week_one_start ?? TRAINING_WEEK_ONE_START
  );
  const diffDays = differenceInDays(weekStart, anchor);
  return Math.floor(diffDays / 7) + 1;
}

export function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date) {
  const start = getWeekStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

export function toLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function enrich(session) {
  return {
    ...session,
    category: getSportCategory(session.sport),
    time_s: getSessionTime(session),
    weekNumber: session.start_date_local
      ? getWeekNumber(new Date(session.start_date_local))
      : null,
  };
}

export function upsertSession(tenantId, kind, session) {
  const db = getDb();
  const data = JSON.stringify(session);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (tenant_id, id, kind, sport, start_date_local, title, name, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id) DO UPDATE SET
       kind = excluded.kind,
       sport = excluded.sport,
       start_date_local = excluded.start_date_local,
       title = excluded.title,
       name = excluded.name,
       data = excluded.data,
       updated_at = excluded.updated_at`
  ).run(
    tenantId,
    String(session.id),
    kind,
    session.sport ?? null,
    session.start_date_local ?? null,
    session.title ?? null,
    session.name ?? null,
    data,
    now,
    now
  );
}

export function upsertExternalSession(tenantId, source, externalId, incoming) {
  const db = getDb();
  const external = String(externalId);
  const mapping = db.prepare(
    "SELECT activity_id FROM activity_sources WHERE tenant_id = ? AND source = ? AND external_activity_id = ?"
  ).get(tenantId, source, external);
  let id = mapping?.activity_id ?? randomUUID();
  let existing = null;
  if (mapping) {
    const row = db.prepare("SELECT data FROM sessions WHERE tenant_id = ? AND id = ? AND kind = 'completed'").get(tenantId, id);
    if (row) {
      try { existing = JSON.parse(row.data); } catch { existing = null; }
    }
  }
  const session = {
    ...(incoming ?? {}),
    ...(existing ?? {}),
    ...incoming,
    id,
    source,
    external_id: external,
    // Local edits remain authoritative when the source is synced again.
    title: existing?.title ?? incoming?.title,
    notes: existing?.notes ?? incoming?.notes,
  };
  upsertSession(tenantId, "completed", session);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO activity_sources (activity_id, tenant_id, source, external_activity_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(tenant_id, source, external_activity_id) DO UPDATE SET activity_id = excluded.activity_id, updated_at = excluded.updated_at`
  ).run(id, tenantId, source, external, now, now);
  return session;
}

export function deleteSession(id) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE tenant_id = ? AND id = ?").run(
    getTenantId(),
    String(id)
  );
}

function rowsToSessions(rows) {
  return rows.map((r) => enrich(JSON.parse(r.data)));
}

export function loadCompletedSessions() {
  const tenantId = getTenantId();
  if (!tenantId) return [];
  const rows = getDb()
    .prepare(
      "SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'completed' ORDER BY start_date_local"
    )
    .all(tenantId);
  return rowsToSessions(rows);
}

export function loadCompletedSessionsSince(cutoffDate) {
  const tenantId = getTenantId();
  if (!tenantId) return [];
  const rows = getDb()
    .prepare(
      `SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'completed'
       AND substr(start_date_local, 1, 10) >= ? ORDER BY start_date_local`
    )
    .all(tenantId, cutoffDate);
  return rowsToSessions(rows);
}

export function cleanupOldPlanned() {
  // El histórico del plan rolling no se elimina automáticamente. Las sesiones
  // antiguas se conservan para análisis, contexto y trazabilidad.
  return 0;
}

export function loadPlannedSessions({ activeOnly = false } = {}) {
  cleanupOldPlanned();
  const tenantId = getTenantId();
  if (!tenantId) return [];
  const activeClause = activeOnly
    ? "AND (json_extract(data, '$.plan_id') IS NULL OR json_extract(data, '$.plan_id') = COALESCE((SELECT id FROM plans WHERE tenant_id = ? AND active = 1 LIMIT 1), (SELECT id FROM plans WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1)))"
    : "";
  const params = activeOnly ? [tenantId, tenantId, tenantId] : [tenantId];
  const rows = getDb()
    .prepare(`SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'planned' ${activeClause} ORDER BY start_date_local`)
    .all(...params);
  return rowsToSessions(rows);
}

export function loadAllSessions() {
  return { completed: loadCompletedSessions(), planned: loadPlannedSessions({ activeOnly: true }) };
}

export function getSession(id) {
  const row = getDb()
    .prepare("SELECT data, kind FROM sessions WHERE tenant_id = ? AND id = ?")
    .get(getTenantId(), String(id));
  if (!row) return null;
  const session = JSON.parse(row.data);
  return { ...enrich(session), kind: row.kind };
}

export function getMergedCompletedSession(plannedSession, tenantId = getTenantId()) {
  const completedId = plannedSession?.merged_with;
  if (!completedId || !tenantId) return null;
  const row = getDb()
    .prepare("SELECT data FROM sessions WHERE tenant_id = ? AND kind = 'completed' AND id = ?")
    .get(tenantId, String(completedId));
  if (!row) return null;
  try {
    return enrich(JSON.parse(row.data));
  } catch {
    return null;
  }
}

export function updateSession(id, updates) {
  const row = getDb()
    .prepare("SELECT data, kind FROM sessions WHERE tenant_id = ? AND id = ?")
    .get(getTenantId(), String(id));
  if (!row) return null;
  const session = { ...JSON.parse(row.data), ...updates, id: String(id) };
  upsertSession(getTenantId(), row.kind, session);
  return enrich(session);
}

export function getAthleteProfile(tenantId = getTenantId()) {
  if (!tenantId) return null;
  const row = getDb()
    .prepare("SELECT data FROM athlete_profiles WHERE tenant_id = ?")
    .get(tenantId);
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export function saveAthleteProfile(tenantId, profile) {
  if (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile) ||
    Object.keys(profile).length === 0
  ) {
    return false;
  }
  getDb()
    .prepare(
      `INSERT INTO athlete_profiles (tenant_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .run(tenantId, JSON.stringify(profile), new Date().toISOString());
  return true;
}
