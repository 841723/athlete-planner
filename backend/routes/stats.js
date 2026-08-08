import { loadAllSessions } from "../lib/sessions.js";
import { buildStats } from "../lib/stats.js";
import { buildStatsRecords } from "../lib/stats-records.js";
import { buildCharts } from "../lib/charts.js";
import { buildWeeklySummary } from "../lib/weekly.js";
import { sendJson } from "../lib/http.js";

export function register(router) {
  router.get("/api/stats", (c) => {
    const { completed } = loadAllSessions();
    return sendJson(c.res, 200, buildStats(completed));
  });

  router.get("/api/stats-records", (c) => {
    const { completed } = loadAllSessions();
    return sendJson(c.res, 200, buildStatsRecords(completed));
  });

  router.get("/api/charts", (c) => {
    const { completed } = loadAllSessions();
    const weekly = buildWeeklySummary(completed);
    return sendJson(c.res, 200, buildCharts(completed, weekly));
  });
}
