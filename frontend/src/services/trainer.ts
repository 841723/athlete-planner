import type {
  GeneratePlanRequest,
  Plan,
  PlanChat,
  PlanChatReply,
  AiPrompt,
  ProfileVersion,
  ProfileVersionFull,
} from "@/types/session";
import { get, send } from "./api";

export function generatePlan(payload: GeneratePlanRequest): Promise<Plan> {
  return send("/generate-plan", "POST", payload);
}

export function regeneratePlan(planId: string): Promise<Plan> {
  return send(`/plans/${encodeURIComponent(planId)}/generate`, "POST");
}

export function fetchPlans(): Promise<Plan[]> {
  return get("/plans");
}

export function fetchPlanChat(planId: string): Promise<PlanChat> {
  return get(`/plans/${encodeURIComponent(planId)}/chat`);
}

export function sendPlanChat(planId: string, message: string): Promise<PlanChatReply> {
  return send(`/plans/${encodeURIComponent(planId)}/chat`, "POST", { message });
}

export function deletePlanChat(planId: string): Promise<void> {
  return send(`/plans/${encodeURIComponent(planId)}/chat`, "DELETE");
}

export function fetchProfile(): Promise<Record<string, unknown>> {
  return get("/profile");
}

export function updateProfile(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  return send("/profile", "PUT", payload);
}

export function fetchProfileHistory(): Promise<ProfileVersion[]> {
  return get("/profile/history");
}

export function fetchProfileVersion(versionId: string): Promise<ProfileVersionFull> {
  return get(`/profile/history/${encodeURIComponent(versionId)}`);
}

export function setActiveProfileVersion(versionId: string): Promise<{ ok: boolean }> {
  return send("/profile/active", "PUT", { versionId });
}

export function fetchPrompts(): Promise<AiPrompt[]> {
  return get("/prompts");
}

export function fetchPrompt(promptId: string): Promise<AiPrompt> {
  return get(`/prompts/${encodeURIComponent(promptId)}`);
}

export function savePrompt(payload: {
  name: string;
  content: string;
}): Promise<{ id: string }> {
  return send("/prompts", "POST", payload);
}

export function updatePrompt(
  promptId: string,
  payload: { name: string; content: string }
): Promise<{ ok: boolean }> {
  return send(`/prompts/${encodeURIComponent(promptId)}`, "PUT", payload);
}

export function deletePrompt(promptId: string): Promise<void> {
  return send(`/prompts/${encodeURIComponent(promptId)}`, "DELETE");
}
