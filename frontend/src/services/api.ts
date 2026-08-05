import type {
  Session,
  SessionsResponse,
  PlannedSessionView,
  WeeklySummary,
  StatsData,
  ChartsData,
  RaceGoal,
  MetaData,
  GeneratePlanRequest,
  GeneratePlanResponse,
  StatsRecordsData,
  SyncResult,
} from "@/types/session";
import type { MeResponse, Member, User, TenantRole } from "@/types/auth";

const BASE = "/api";

let activeTenantId: string | null = null;

export function setApiTenant(tenantId: string | null) {
  activeTenantId = tenantId;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (activeTenantId) headers["X-Tenant-Id"] = activeTenantId;
  return headers;
}

function handleUnauthorized() {
  window.dispatchEvent(new Event("auth:unauthorized"));
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(`API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: { ...authHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `API ${res.status}: ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function fetchSessions(): Promise<SessionsResponse> {
  return get("/sessions");
}

export function fetchWeekly(): Promise<WeeklySummary[]> {
  return get("/weekly");
}

export function fetchStats(): Promise<StatsData> {
  return get("/stats");
}

export function fetchCharts(): Promise<ChartsData> {
  return get("/charts");
}

export function fetchGoals(): Promise<RaceGoal[]> {
  return get("/goals");
}

export function updateGoals(goals: RaceGoal[]): Promise<{ ok: boolean }> {
  return send("/goals", "PUT", { goals });
}

export function fetchMeta(): Promise<MetaData> {
  return get("/meta");
}

export function fetchPlanned(): Promise<PlannedSessionView[]> {
  return get("/planned");
}

export function createPlanned(payload: Partial<Session>): Promise<PlannedSessionView> {
  return send("/planned", "POST", payload);
}

export function updatePlanned(
  id: string,
  payload: Partial<Session>
): Promise<PlannedSessionView> {
  return send(`/planned/${encodeURIComponent(id)}`, "PUT", payload);
}

export function deletePlanned(id: string): Promise<void> {
  return send(`/planned/${encodeURIComponent(id)}`, "DELETE");
}

export function generatePlan(payload: GeneratePlanRequest): Promise<GeneratePlanResponse> {
  return send("/generate-plan", "POST", payload);
}

export function syncGarmin(): Promise<SyncResult> {
  return send("/sync", "POST");
}

export function updateSession(id: string, payload: Partial<Session>): Promise<Session> {
  return send(`/sessions/${encodeURIComponent(id)}`, "PUT", payload);
}

export function fetchSession(id: string): Promise<Session> {
  return get(`/sessions/${encodeURIComponent(id)}`);
}

export function fetchStatsRecords(): Promise<StatsRecordsData> {
  return get("/stats-records");
}

export function fetchProfile(): Promise<Record<string, unknown>> {
  return get("/profile");
}

export function updateProfile(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  return send("/profile", "PUT", payload);
}

export function fetchAuthConfig(): Promise<{ clientId: string | null }> {
  return get("/auth/config");
}

export function googleLogin(credential: string): Promise<{ user: User }> {
  return send("/auth/google", "POST", { credential });
}

export function logout(): Promise<{ ok: boolean }> {
  return send("/auth/logout", "POST");
}

export function fetchMe(): Promise<MeResponse> {
  return get("/me");
}

export function switchTenant(tenantId: string): Promise<{ activeTenantId: string }> {
  return send("/switch-tenant", "POST", { tenantId });
}

export function fetchMembers(tenantId: string): Promise<Member[]> {
  return get(`/tenants/${encodeURIComponent(tenantId)}/members`);
}

export function updateTenantName(name: string): Promise<{ name: string }> {
  return send(`/tenants/${encodeURIComponent(activeTenantId ?? "")}/name`, "PUT", { name });
}

export function addMember(
  tenantId: string,
  payload: { email: string; role: TenantRole }
): Promise<Member> {
  return send(`/tenants/${encodeURIComponent(tenantId)}/members`, "POST", payload);
}

export function updateMemberRole(
  tenantId: string,
  userId: string,
  role: TenantRole
): Promise<{ ok: boolean }> {
  return send(`/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`, "PUT", {
    role,
  });
}

export function removeMember(tenantId: string, userId: string): Promise<void> {
  return send(`/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`, "DELETE");
}
