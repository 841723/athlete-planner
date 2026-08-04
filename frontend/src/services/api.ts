import type {
  Session,
  SessionsResponse,
  PlannedSessionView,
  WeeklySummary,
  StatsData,
  ChartsData,
  RaceGoal,
  MetaData,
} from "@/types/session";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
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
