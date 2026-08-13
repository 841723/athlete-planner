import { cancelJob, getJob, listJobs } from "../lib/jobs.js";
import { sendJson, canWrite } from "../lib/http.js";

export function register(router) {
  router.get("/api/jobs", (c) => {
    return sendJson(c.res, 200, listJobs(c.tenantId, {
      activeOnly: c.url?.searchParams?.get("active") === "true",
      limit: c.url?.searchParams?.get("limit") ?? 50,
    }));
  });

  router.get("/api/jobs/:id", (c) => {
    const job = getJob(c.tenantId, c.params.id);
    if (!job) return sendJson(c.res, 404, { error: "Tarea no encontrada" });
    return sendJson(c.res, 200, job);
  });

  router.post("/api/jobs/:id/cancel", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    if (!cancelJob(c.tenantId, c.params.id)) {
      return sendJson(c.res, 409, { error: "La tarea ya ha terminado o no existe" });
    }
    return sendJson(c.res, 200, getJob(c.tenantId, c.params.id));
  });
}
