import type {
  CoachChat,
  CoachChatReply,
  ProfileVersion,
  ProfileVersionFull,
} from "@/types/session";
import { get, send } from "./api";

export function fetchCoachChat(): Promise<CoachChat> {
  return get("/chat");
}

export function sendCoachChat(message: string): Promise<CoachChatReply> {
  return send("/chat", "POST", { message });
}

export function cancelCoachChat(): Promise<{ cancelled: boolean }> {
  return send("/chat/cancel", "POST");
}

export function updateCoachChatInstructions(instructions: string): Promise<{ instructions: string }> {
  return send("/chat/settings", "PUT", { instructions });
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