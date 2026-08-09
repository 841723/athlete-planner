import { runPython, GARMIN_LOGIN } from "./sync-run.js";

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
