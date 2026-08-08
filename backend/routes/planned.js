import { listPlanned, createPlanned, updatePlanned, deletePlanned } from "../lib/planned.js";
import { sendJson, readBody, canWrite } from "../lib/http.js";

export function register(router) {
  router.get("/api/planned", (c) => {
    return sendJson(c.res, 200, listPlanned());
  });

  router.post("/api/planned", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    return sendJson(c.res, 201, createPlanned(body ?? {}));
  });

  router.put("/api/planned/:id", async (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    return sendJson(c.res, 200, updatePlanned(c.params.id, body ?? {}));
  });

  router.delete("/api/planned/:id", (c) => {
    if (!canWrite(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    deletePlanned(c.params.id);
    c.res.writeHead(204);
    return c.res.end();
  });
}
