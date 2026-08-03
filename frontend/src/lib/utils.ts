import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth, getWeek } from "date-fns";
import { SportCategory, SPORT_CATEGORIES, SPORT_COLORS, SPORT_LABELS, Session } from "@/types/session";

export function formatDistance(meters: number | undefined): string {
  if (meters == null) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatPace(paceSperKm: number | undefined): string {
  if (paceSperKm == null) return "—";
  const min = Math.floor(paceSperKm / 60);
  const sec = paceSperKm % 60;
  return `${min}:${sec.toString().padStart(2, "0")} min/km`;
}

export function formatSpeed(speedMs: number | undefined): string {
  if (speedMs == null) return "—";
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy");
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "EEE d");
}

export function formatWeekLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
}

export function getSportCategory(sport: string): SportCategory {
  return SPORT_CATEGORIES[sport] ?? "other";
}

export function getSportColor(sport: string): string {
  return SPORT_COLORS[getSportCategory(sport)];
}

export function getSportLabel(sport: string): string {
  return SPORT_LABELS[getSportCategory(sport)];
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1 });
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function daysBetween(a: string, b: string): number {
  return differenceInDays(parseISO(b), parseISO(a));
}

export function isDateInRange(date: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const d = parseISO(date);
  return isWithinInterval(d, {
    start: from ? parseISO(from) : new Date(0),
    end: to ? parseISO(to) : new Date(Infinity),
  });
}

export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}