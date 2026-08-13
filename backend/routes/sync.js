import { createJob } from "../lib/jobs.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

export function register(router) {
  router.post("/api/sync", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    try {
      const job = createJob({
        tenantId: c.tenantId,
        userId: c.actor?.userId ?? null,
        type: "sync",
        dedupeKey: "sync:garmin",
        payload: { force: body?.force === true },
        deepLink: `/${c.tenantId}/calendar`,
      });
      return sendJson(c.res, 202, job);
    } catch (error) {
      if (error?.status === 409) return sendJson(c.res, 409, { error: error.message, job: error.job ?? null });
      throw error;
    }
  });
}
