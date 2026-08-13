import fs from "node:fs";
import path from "node:path";
import { getMembership } from "./auth.js";

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

export function sendError(res, err) {
  const status = err.status ?? 500;
  sendJson(res, status, { error: err.message ?? "Error interno" });
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let raw = "";
    req.on("data", (chunk) => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 1_000_000) {
        settled = true;
        reject(Object.assign(new Error("Cuerpo demasiado grande"), { status: 413 }));
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

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setCookie(res, name, value, maxAge) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

export function serveStatic(req, res, staticDir) {
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
  const root = path.resolve(staticDir);
  let filePath = path.resolve(root, urlPath === "/" ? "index.html" : `.${urlPath}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) filePath = path.join(root, "index.html");
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

export function requireMember(tenantId, user) {
  if (!user) {
    const err = new Error("Sin acceso a este tenant");
    err.status = 403;
    throw err;
  }
  const membership = getMembership(tenantId, user.id);
  if (!membership) {
    const err = new Error("Sin acceso a este tenant");
    err.status = 403;
    throw err;
  }
  return membership;
}

export function requireRole(membership, roles) {
  if (!membership || !roles.includes(membership.role)) {
    const err = new Error("No tienes permisos para esta acción");
    err.status = 403;
    throw err;
  }
}

export const canWrite = (m) => !!m && m.role !== "visitor";
export const canManage = (m) => !!m && (m.role === "admin" || m.role === "athlete");

export function requireSuperAdmin(user) {
  if (!user?.is_superadmin) {
    const err = new Error("No tienes permisos de administración");
    err.status = 403;
    throw err;
  }
  return user;
}
