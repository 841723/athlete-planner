import { sendEvent, subscribeTenant } from "../lib/realtime.js";

export function register(router) {
  router.get("/api/events", (c) => {
    c.res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    c.res.flushHeaders?.();
    sendEvent(c.res, "ready", { tenantId: c.tenantId });
    subscribeTenant(c.tenantId, c.res);
    return c.res;
  });
}
