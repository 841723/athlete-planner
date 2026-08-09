import { getEquipment, saveEquipment, getEquipmentCatalog, saveEquipmentCatalog } from "../lib/equipment.js";
import { sendJson, readBody, canManage } from "../lib/http.js";

export function register(router) {
  router.get("/api/equipment", (c) => {
    return sendJson(c.res, 200, {
      items: getEquipment(c.tenantId),
      catalog: getEquipmentCatalog(c.tenantId),
    });
  });

  router.put("/api/equipment", async (c) => {
    if (!canManage(c.membership)) return sendJson(c.res, 403, { error: "No tienes permisos para esta acción" });
    const body = await readBody(c.req);
    if (!Array.isArray(body?.items)) return sendJson(c.res, 400, { error: "Falta items" });
    saveEquipment(c.tenantId, body.items);
    if (Array.isArray(body?.catalog)) {
      saveEquipmentCatalog(c.tenantId, body.catalog);
    }
    return sendJson(c.res, 200, { ok: true });
  });
}
