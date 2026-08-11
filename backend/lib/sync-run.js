import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const SCRIPTS_DIR = path.join(ROOT, "scripts");
export const GARMIN_FETCH = path.join(SCRIPTS_DIR, "garmin-fetch.py");
export const GARMIN_LOGIN = path.join(SCRIPTS_DIR, "garmin-login.py");
export const SYNC_SESSIONS = path.join(SCRIPTS_DIR, "sync-sessions.mjs");

export const GARMIN_DEPS = "garminconnect==0.3.8";
export const PYTHON_VERSION = "3.12";

export function run(cmd, args, { cwd = ROOT, env = null, timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill("SIGKILL");
            if (!settled) {
              settled = true;
              const err = new Error(`El comando ${cmd} superó el límite de ${Math.round(timeoutMs / 1000)}s`);
              err.timeout = true;
              reject(err);
            }
          }, timeoutMs)
        : null;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else {
        const err = new Error(stderr.trim() || `El comando ${cmd} terminó con código ${code}`);
        err.exitCode = code;
        err.stderr = stderr.trim();
        reject(err);
      }
    });
  });
}

export function runPython(script, args, env = undefined, timeoutMs = 10 * 60 * 1000) {
  return run("uv", ["run", "--python", PYTHON_VERSION, "--with", GARMIN_DEPS, "python", script, ...args], { env, timeoutMs });
}

export function runNode(script, args, timeoutMs = 5 * 60 * 1000) {
  return run("node", [script, ...args], { timeoutMs });
}
