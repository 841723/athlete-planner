import { createRouter } from "../lib/router.js";
import { registerPublic, registerUser } from "./auth.js";
import { register as registerTenants } from "./tenants.js";
import { register as registerSessions } from "./sessions.js";
import { register as registerWeekly } from "./weekly.js";
import { register as registerStats } from "./stats.js";
import { register as registerGoals } from "./goals.js";
import { register as registerPlanned } from "./planned.js";
import { register as registerTrainer } from "./trainer.js";
import { register as registerProfile } from "./profile.js";
import { register as registerAi } from "./ai.js";
import { register as registerSync } from "./sync.js";
import { register as registerApiKeys } from "./api-keys.js";
import { register as registerAiLogs } from "./ai-logs.js";
import { register as registerPlanChat } from "./plan-chat.js";

export function buildPublicRouter() {
  const router = createRouter();
  registerPublic(router);
  return router;
}

export function buildUserRouter() {
  const router = createRouter();
  registerUser(router);
  return router;
}

export function buildTenantRouter() {
  const router = createRouter();
  registerTenants(router);
  registerSessions(router);
  registerWeekly(router);
  registerStats(router);
  registerGoals(router);
  registerPlanned(router);
  registerTrainer(router);
  registerProfile(router);
  registerAi(router);
  registerSync(router);
  registerApiKeys(router);
  registerAiLogs(router);
  registerPlanChat(router);
  return router;
}
