import { loadAllSessions } from "../lib/sessions.js";
import { buildWeeklySummary } from "../lib/weekly.js";
import { sendJson } from "../lib/http.js";

export function register(router) {
  router.get("/api/weekly", (c) => {
    const { completed } = loadAllSessions();
    return sendJson(c.res, 200, buildWeeklySummary(completed));
  });
}
