import { getDb } from "./db.js";

export function saveTrack(tenantId, sessionId, { sport, polyline, samples }) {
  const pl = Array.isArray(polyline) ? polyline : [];
  const sm = Array.isArray(samples) ? samples : [];
  const sessionRow = getDb()
    .prepare("SELECT sport FROM sessions WHERE tenant_id = ? AND id = ?")
    .get(tenantId, String(sessionId));
  const resolvedSport = sport ?? sessionRow?.sport ?? null;
  getDb()
    .prepare(
      `INSERT INTO activity_tracks (tenant_id, session_id, sport, polyline, samples, point_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, session_id) DO UPDATE SET
         sport = excluded.sport,
         polyline = excluded.polyline,
         samples = excluded.samples,
         point_count = excluded.point_count,
         updated_at = excluded.updated_at`
    )
    .run(
      tenantId,
      String(sessionId),
      resolvedSport,
      JSON.stringify(pl),
      JSON.stringify(sm),
      pl.length,
      new Date().toISOString()
    );
}

export function getTrack(tenantId, sessionId) {
  const row = getDb()
    .prepare("SELECT sport, polyline, samples FROM activity_tracks WHERE tenant_id = ? AND session_id = ?")
    .get(tenantId, String(sessionId));
  if (!row) return null;
  try {
    const polyline = JSON.parse(row.polyline);
    const samples = JSON.parse(row.samples);
    if (!polyline.length && !samples.length) return null;
    const points = polyline
      .map((p) => ({
        lat: p[0],
        lng: p[1],
        ...(p[2] != null ? { elevation_m: p[2] } : {}),
      }))
      .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const mappedSamples = samples.map((s) => {
      const out = {
        ...(s.distance != null ? { distance_m: s.distance } : {}),
        ...(s.hr != null ? { heartrate: s.hr } : {}),
        ...(s.power != null ? { watts: s.power } : {}),
        ...(s.speed != null ? { speed_ms: s.speed } : {}),
        ...(s.elevation != null ? { elevation_m: s.elevation } : {}),
      };
      if (s.speed != null && s.speed > 0) out.pace_s_per_km = Math.round(1000 / s.speed);
      return out;
    });
    return { sessionId: String(sessionId), sport: row.sport, points, samples: mappedSamples };
  } catch {
    return null;
  }
}

export function existingTrackIds(tenantId) {
  const rows = getDb()
    .prepare(
      `SELECT session_id FROM activity_tracks
       WHERE tenant_id = ? AND (point_count > 1 OR (samples IS NOT NULL AND samples != '[]'))`
    )
    .all(tenantId);
  return new Set(rows.map((r) => String(r.session_id)));
}
