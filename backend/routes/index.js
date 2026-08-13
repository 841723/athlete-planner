import { createRouter } from "../lib/router.js";
import { registerPublic, registerUser } from "./auth.js";
import { registerAdmin } from "./admin.js";
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
import { register as registerSyncSources, registerPublic as registerSyncSourcesPublic } from "./sync-sources.js";
import { register as registerApiKeys } from "./api-keys.js";
import { register as registerAiLogs } from "./ai-logs.js";
import { register as registerPlanChat } from "./plan-chat.js";
import { register as registerEquipment } from "./equipment.js";
import { register as registerAiConfigs } from "./ai-configs.js";
import { register as registerPush } from "./push.js";
import { register as registerJobs } from "./jobs.js";

export function buildPublicRouter() {
  const router = createRouter();
  registerPublic(router);
  registerSyncSourcesPublic(router);
  return router;
}

export function buildUserRouter() {
  const router = createRouter();
  registerUser(router);
  registerAdmin(router);
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
  registerSyncSources(router);
  registerApiKeys(router);
  registerAiLogs(router);
  registerPlanChat(router);
  registerEquipment(router);
  registerAiConfigs(router);
  registerPush(router);
  registerJobs(router);
  return router;
}
