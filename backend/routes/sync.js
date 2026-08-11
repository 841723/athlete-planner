import { runSync } from "../lib/sync.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

export function register(router) {
  router.post("/api/sync", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    const result = await runSync({
      force: body?.force === true,
    });
    return sendJson(c.res, 200, result);
  });
}
