import type { Session } from "@/types/session";

const allFiles = import.meta.glob("/sessions/**/*.json", { eager: true }) as Record<string, Session>;
const plannedFiles = import.meta.glob("/sessions/planned/**/*.json", { eager: true }) as Record<string, Session>;

const plannedKeys = new Set(Object.keys(plannedFiles));

const completedFiles = Object.fromEntries(
  Object.entries(allFiles).filter(([key]) => !plannedKeys.has(key))
) as Record<string, Session>;

export function loadCompletedSessions(): Session[] {
  return Object.values(completedFiles).filter((s) => s && s.id);
}

export function loadPlannedSessions(): Session[] {
  return Object.values(plannedFiles).filter((s) => s && s.id);
}

export function loadAllSessions(): { completed: Session[]; planned: Session[] } {
  const completed = loadCompletedSessions();
  console.log("Completed sessions loaded:", completed.length);
  
  return {
    completed: completed,
    planned: loadPlannedSessions(),
  };
}

export function loadSessionById(id: string): Session | null {
  const all = loadCompletedSessions();
  return all.find((s) => s.id === id) ?? null;
}