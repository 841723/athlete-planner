import { getDb } from "./db.js";
import { upsertSession, getTenantId } from "./sessions.js";
import { saveTrack } from "./track.js";
import { mergePlannedWithCompleted } from "./merge.js";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth/token";

const SPORT_MAP = {
  Run: "running",
  TrailRun: "trail_running",
  VirtualRun: "running",
  Ride: "cycling",
  EBikeRide: "cycling",
  VirtualRide: "virtual_ride",
  Swim: "lap_swimming",
  Walk: "walking",
  Hike: "hiking",
  WeightTraining: "strength_training",
  Workout: "training",
  Yoga: "training",
  Crossfit: "strength_training",
  Elliptical: "elliptical",
  StairStepper: "strength_training",
  RockClimbing: "other",
  Surfing: "other",
  Rowing: "other",
  Kayaking: "other",
  StandUpPaddling: "other",
  Snowboard: "other",
  NordicSki: "other",
  AlpineSki: "other",
  InlineSkate: "other",
  Golf: "other",
  Soccer: "other",
  Tennis: "other",
  Pickleball: "other",
  Other: "other",
};

export function stravaConfigured() {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

function clientCredentials() {
  return {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
  };
}

export function stravaAuthorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "read,activity:read_all",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

async function oauthExchange(form) {
  const body = { ...clientCredentials(), ...form };
  const res = await fetch(`${OAUTH}?${new URLSearchParams(body).toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava OAuth ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function stravaExchangeCode(code) {
  const data = await oauthExchange({
    code,
    grant_type: "authorization_code",
  });
  if (!data.access_token) throw new Error("Strava no devolvió access_token");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_name: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(" ").trim(),
  };
}

export async function stravaRefreshAccessToken(refreshToken) {
  const data = await oauthExchange({ refresh_token: refreshToken, grant_type: "refresh_token" });
  if (!data.access_token) throw new Error("Strava no devolvió access_token");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: data.expires_at,
  };
}

async function stravaFetch(tokens, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    const err = new Error("Token de Strava caducado o inválido");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export function mapSport(sportType) {
  return SPORT_MAP[sportType] ?? "other";
}

export function normalizeStravaActivity(a) {
  const sport = mapSport(a.sport_type ?? a.type);
  const avgSpeed = typeof a.average_speed === "number" ? a.average_speed : null;
  const session = {
    schema_version: 4,
    id: String(a.id),
    sport,
    name: a.name ?? "Strava",
    start_date_local: (a.start_date_local ?? "").slice(0, 19),
    distance_m: a.distance ?? 0,
    moving_time_s: a.moving_time ?? 0,
    elapsed_time_s: a.elapsed_time ?? 0,
  };
  if (avgSpeed != null) {
    session.avg_speed_ms = Math.round(avgSpeed * 1000) / 1000;
    session.avg_pace_s_per_km = Math.round(1000 / avgSpeed);
  }
  if (typeof a.max_speed === "number") session.max_speed_ms = Math.round(a.max_speed * 1000) / 1000;
  if (typeof a.average_heartrate === "number") session.avg_heartrate = Math.round(a.average_heartrate);
  if (typeof a.max_heartrate === "number") session.max_heartrate = Math.round(a.max_heartrate);
  if (typeof a.average_watts === "number") session.avg_watts = Math.round(a.average_watts);
  if (typeof a.max_watts === "number") session.max_watts = Math.round(a.max_watts);
  if (typeof a.total_elevation_gain === "number") session.total_elevation_gain_m = Math.round(a.total_elevation_gain);
  if (typeof a.average_temp === "number") session.average_temp_c = a.average_temp;
  if (typeof a.calories === "number") session.calories_kcal = Math.round(a.calories);

  const laps = Array.isArray(a.laps) ? a.laps : [];
  const splits = Array.isArray(a.splits_metric) ? a.splits_metric : [];
  const segments = [...laps, ...splits]
    .filter((s) => s && (s.distance ?? 0) > 0)
    .map((s) => {
      const time = s.moving_time ?? s.elapsed_time ?? null;
      const spd = typeof s.average_speed === "number" ? s.average_speed : null;
      const seg = { distance_m: Math.round(s.distance) };
      if (time != null) seg.time_s = Math.round(time);
      if (spd != null) {
        seg.avg_speed_ms = Math.round(spd * 1000) / 1000;
        seg.avg_pace_s_per_km = Math.round(1000 / spd);
      }
      if (typeof s.average_heartrate === "number") seg.avg_heartrate = Math.round(s.average_heartrate);
      if (typeof s.average_watts === "number") seg.avg_watts = Math.round(s.average_watts);
      if (typeof s.elevation_difference === "number" && s.elevation_difference > 0) {
        seg.total_elevation_gain_m = Math.round(s.elevation_difference);
      }
      return seg;
    });
  if (segments.length) session.segments = segments;

  const bestEfforts = Array.isArray(a.best_efforts)
    ? a.best_efforts
        .filter((e) => e && typeof e.distance === "number" && typeof e.elapsed_time === "number")
        .map((e) => ({ name: e.name, distance_m: Math.round(e.distance), elapsed_time_s: Math.round(e.elapsed_time) }))
    : [];
  if (bestEfforts.length) session.best_efforts = bestEfforts;
  else session.best_efforts = [];

  return session;
}

function decodePolyline(str) {
  const factor = 1e5;
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const read = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    lat += read();
    lng += read();
    points.push([lat / factor, lng / factor, null]);
  }
  return points;
}

async function fetchDetail(tokens, id) {
  return stravaFetch(tokens, `/activities/${id}`);
}

export async function syncStrava(tenantId, source) {
  let tokens = source.tokens;
  if (!tokens?.access_token) throw new Error("Strava no está conectado");

  if (tokens.expires_at && Date.now() / 1000 >= tokens.expires_at - 60) {
    const refreshed = await stravaRefreshAccessToken(tokens.refresh_token);
    tokens = { ...tokens, ...refreshed };
    source.tokens = tokens;
  }

  const config = source.config ?? {};
  const minDate = config.min_date ?? process.env.MIN_DATE ?? "2026-05-12";
  const after = Math.floor(new Date(`${minDate}T00:00:00`).getTime() / 1000);

  const existing = new Set(
    getDb()
      .prepare("SELECT id FROM sessions WHERE tenant_id = ? AND kind = 'completed'")
      .all(tenantId)
      .map((r) => String(r.id))
  );

  const newIds = [];
  let page = 1;
  while (true) {
    const pageData = await stravaFetch(tokens, `/athlete/activities?after=${after}&per_page=200&page=${page}`);
    if (!Array.isArray(pageData) || pageData.length === 0) break;
    for (const act of pageData) {
      if (!existing.has(String(act.id))) newIds.push(String(act.id));
    }
    if (pageData.length < 200) break;
    page++;
    if (page > 20) break;
  }

  let imported = 0;
  let tracks = 0;
  for (const id of newIds) {
    const detail = await fetchDetail(tokens, id);
    const session = normalizeStravaActivity(detail);
    upsertSession(tenantId, "completed", session);
    imported++;
    const polyline = detail?.map?.summary_polyline;
    if (typeof polyline === "string" && polyline.length > 0) {
      saveTrack(tenantId, id, { sport: session.sport, polyline: decodePolyline(polyline), samples: [] });
      tracks++;
    }
  }

  const merged = imported > 0 ? mergePlannedWithCompleted() : undefined;

  return {
    synced: imported,
    skipped: 0,
    filtered: 0,
    missing: newIds.length,
    ids: newIds,
    tracks,
    merged,
  };
}
