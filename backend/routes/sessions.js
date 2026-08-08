import {
  loadAllSessions,
  getSessionTime,
  getSession,
  updateSession,
} from "../lib/sessions.js";
import { getTrack } from "../lib/track.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

export function register(router) {
  router.get("/api/sessions", (c) => {
    const { completed, planned } = loadAllSessions();
    const totals = completed.reduce(
      (acc, s) => {
        acc.totalDistance += s.distance_m ?? 0;
        acc.totalHours += getSessionTime(s) / 3600;
        acc.totalSessions += 1;
        return acc;
      },
      { totalDistance: 0, totalHours: 0, totalSessions: 0 }
    );
    const totalsCompleted = completed.reduce(
      (acc, s) => {
        acc.totalDistance += s.distance_m ?? 0;
        acc.totalHours += getSessionTime(s) / 3600;
        return acc;
      },
      { totalDistance: 0, totalHours: 0 }
    );
    return sendJson(c.res, 200, { completed, planned, totals, totalsCompleted });
  });

  router.get("/api/sessions/:id/track", (c) => {
    const session = getSession(c.params.id);
    if (!session) return sendJson(c.res, 404, { error: "Sesión no encontrada" });
    const track = getTrack(c.tenantId, c.params.id);
    if (!track) return sendJson(c.res, 404, { error: "Track no disponible" });
    return sendJson(c.res, 200, track);
  });

  router.get("/api/sessions/:id", (c) => {
    const session = getSession(c.params.id);
    if (!session) return sendJson(c.res, 404, { error: "Sesión no encontrada" });
    return sendJson(c.res, 200, session);
  });

  router.put("/api/sessions/:id", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const updated = updateSession(c.params.id, body ?? {});
    if (!updated) return sendJson(c.res, 404, { error: "Sesión no encontrada" });
    return sendJson(c.res, 200, updated);
  });
}
