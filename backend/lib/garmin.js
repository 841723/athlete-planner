import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPython, GARMIN_LOGIN, GARMIN_FETCH } from "./sync-run.js";

export async function garminLogin({ email, password, mfaCode = null }) {
  const args = ["--email", email, "--password", password];
  if (mfaCode) args.push("--mfa", mfaCode);
  const out = await runPython(GARMIN_LOGIN, args);
  let parsed = null;
  try {
    parsed = JSON.parse(out || "{}");
  } catch {
    throw new Error("Respuesta inesperada del login de Garmin");
  }
  if (parsed.mfa_required) {
    return { mfaRequired: true };
  }
  if (parsed.tokens) {
    return { mfaRequired: false, tokens: parsed.tokens };
  }
  throw new Error("Garmin no devolvió tokens de sesión");
}

export function extractTokens(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.tokens === "string" && parsed.tokens) return parsed.tokens;
      if (typeof parsed.access_token === "string") return trimmed;
    }
  } catch {
    /* no es JSON estructurado */
  }
  return trimmed;
}

export async function validateGarminTokens(tokens) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-tokencheck-"));
  const tokensFile = path.join(workDir, "tokens.json");
  try {
    fs.writeFileSync(tokensFile, tokens);
    await runPython(GARMIN_FETCH, ["ids", "--limit", "1", "--tokens", tokensFile, "--json"]);
    return true;
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignorar */
    }
  }
}
