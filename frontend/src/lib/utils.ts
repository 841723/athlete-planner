import {
  format,
  parseISO,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  endOfDay,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { SportCategory, SPORT_COLORS, SPORT_LABELS } from "@/types/session";

export function safeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function formatDistance(meters: number | undefined): string {
  if (meters == null) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatPace(paceSperKm: number | undefined): string {
  if (paceSperKm == null) return "—";
  const min = Math.floor(paceSperKm / 60);
  const sec = Math.floor(paceSperKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} min/km`;
}

export function formatPacePer100m(secPer100m: number | undefined): string {
  if (secPer100m == null) return "—";
  const min = Math.floor(secPer100m / 60);
  const sec = Math.floor(secPer100m % 60);
  return `${min}:${sec.toString().padStart(2, "0")} min/100m`;
}

export function pacePer100m(timeS: number | undefined, distanceM: number | undefined): number | undefined {
  if (timeS == null || distanceM == null || distanceM <= 0) return undefined;
  return (timeS / distanceM) * 100;
}

export function getFeelLabel(feel: number | undefined): string {
  if (feel == null) return "—";
  if (feel <= 20) return "Muy débil";
  if (feel <= 40) return "Débil";
  if (feel <= 60) return "Media";
  if (feel <= 80) return "Fuerte";
  return "Muy fuerte";
}

export function formatSpeed(speedMs: number | undefined): string {
  if (speedMs == null) return "—";
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy", { locale: es });
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM", { locale: es });
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Fechas legibles en español (ya no se usa el formato "día #semana"):
// - formatFullDate:    "18 abril 2026"       (objetivos y fechas completas)
// - formatWeekdayDate: "martes 18 abr"       (día de la semana + fecha)
// - formatShortDate:   "18 abr"              (fecha corta)
// - formatTrainerDate: "miércoles - 27 dic"  (actividades del entrenador)
export function formatFullDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy", { locale: es });
}

export function formatWeekdayDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE d MMM", { locale: es });
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM", { locale: es });
}

export function formatTrainerDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE - d MMM", { locale: es });
}

export function formatWeekLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
}

export function getSportColor(category: SportCategory | undefined): string {
  return category ? SPORT_COLORS[category] ?? "#6b7280" : "#6b7280";
}

export function getSportLabel(category: SportCategory | undefined): string {
  return category ? SPORT_LABELS[category] ?? "Otros" : "Otros";
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatNumber(value: number | undefined | null, maxDecimals = 0): string {
  if (value == null || !isFinite(value)) return "—";
  const fixed = maxDecimals > 0 ? Number(value.toFixed(maxDecimals)) : Math.round(value);
  const parts = String(fixed).split(".");
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.length > 1 ? `${int},${parts[1]}` : int;
}

export function getWeekNumber(date: Date, trainingWeekOneStart: string): number {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const anchor = parseISO(trainingWeekOneStart);
  const diffDays = differenceInDays(weekStart, anchor);
  return Math.floor(diffDays / 7) + 1;
}

export function isDateInRange(date: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const d = parseISO(date);
  return isWithinInterval(d, {
    start: from ? startOfDay(parseISO(from)) : new Date(0),
    end: to ? endOfDay(parseISO(to)) : new Date(Infinity),
  });
}

export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}
