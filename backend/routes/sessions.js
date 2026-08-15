import {
  loadAllSessions,
  getSessionTime,
  getSession,
  updateSession,
  createManualSession,
  deleteManualSession,
} from "../lib/sessions.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";
import { mergePlannedWithCompleted } from "../lib/merge.js";

export function register(router) {
  router.post("/api/sessions", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const session = createManualSession(body ?? {});
    const merged = mergePlannedWithCompleted();
    return sendJson(c.res, 201, { session, merged });
  });

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

  router.delete("/api/sessions/:id", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (!deleteManualSession(c.params.id)) return sendJson(c.res, 404, { error: "Actividad manual no encontrada" });
    c.res.writeHead(204);
    return c.res.end();
  });
}
