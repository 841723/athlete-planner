import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadAllSessions, getSessionTime } from "./lib/sessions.js";
import { buildWeeklySummary } from "./lib/weekly.js";
import { buildStats } from "./lib/stats.js";
import { buildCharts } from "./lib/charts.js";
import { RACE_GOALS } from "./lib/goals.js";
import { META } from "./lib/meta.js";
import {
  listPlanned,
  createPlanned,
  updatePlanned,
  deletePlanned,
} from "./lib/planned.js";

const args = process.argv.slice(2);
const portArg = Number(process.env.PORT ?? 4000);
let port = portArg;
let staticDir = process.env.STATIC_DIR ?? null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") port = Number(args[++i]);
  else if (args[i] === "--static") {
    const next = args[i + 1];
    staticDir = next && !next.startsWith("--") ? path.resolve(import.meta.dirname, "..", next) : path.resolve(import.meta.dirname, "..", "frontend", "dist");
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, err) {
  const status = err.status ?? 500;
  sendJson(res, status, { error: err.message ?? "Error interno" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let raw = "";
    req.on("data", (chunk) => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 1_000_000) {
        settled = true;
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("JSON inválido"), { status: 400 }));
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res) {
  if (!staticDir || !fs.existsSync(staticDir)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No se ha configurado directorio estático (--static)");
    return;
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    urlPath = "/";
  }
  let filePath = path.join(staticDir, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(staticDir)) filePath = path.join(staticDir, "index.html");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticDir, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Archivo no encontrado");
  }
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  const url = new URL(pathname, "http://localhost");

  if (url.pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/sessions" && method === "GET") {
    const { completed, planned } = loadAllSessions();
    const totals = [...completed, ...planned].reduce(
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
    return sendJson(res, 200, { completed, planned, totals, totalsCompleted });
  }

  if (url.pathname === "/api/weekly" && method === "GET") {
    const { completed, planned } = loadAllSessions();
    return sendJson(res, 200, buildWeeklySummary(completed, planned));
  }

  if (url.pathname === "/api/stats" && method === "GET") {
    const { completed } = loadAllSessions();
    return sendJson(res, 200, buildStats(completed));
  }

  if (url.pathname === "/api/charts" && method === "GET") {
    const { completed, planned } = loadAllSessions();
    const weekly = buildWeeklySummary(completed, planned);
    return sendJson(res, 200, buildCharts(completed, weekly));
  }

  if (url.pathname === "/api/goals" && method === "GET") {
    return sendJson(res, 200, RACE_GOALS);
  }

  if (url.pathname === "/api/meta" && method === "GET") {
    return sendJson(res, 200, META);
  }

  if (url.pathname === "/api/planned") {
    if (method === "GET") return sendJson(res, 200, listPlanned());
    if (method === "POST") {
      const body = await readBody(req);
      return sendJson(res, 201, createPlanned(body ?? {}));
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const plannedMatch = url.pathname.match(/^\/api\/planned\/([^/]+)$/);
  if (plannedMatch) {
    const id = decodeURIComponent(plannedMatch[1]);
    if (method === "PUT") {
      const body = await readBody(req);
      return sendJson(res, 200, updatePlanned(id, body ?? {}));
    }
    if (method === "DELETE") {
      deletePlanned(id);
      res.writeHead(204);
      return res.end();
    }
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  return sendJson(res, 404, { error: "Ruta no encontrada" });
}

const server = http.createServer((req, res) => {
  const pathname = req.url ?? "/";
  if (pathname.startsWith("/api")) {
    handleApi(req, res, pathname).catch((err) => sendError(res, err));
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, () => {
  console.log(`Backend escuchando en http://localhost:${port}`);
  if (staticDir) console.log(`Sirviendo estáticos desde: ${staticDir}`);
});
