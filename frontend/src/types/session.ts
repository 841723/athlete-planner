export type SportCategory =
  | "running"
  | "cycling"
  | "swimming"
  | "strength"
  | "hiking"
  | "walking"
  | "other";

export const SPORT_CATEGORIES: Record<string, SportCategory> = {
  running: "running",
  cycling: "cycling",
  virtual_ride: "cycling",
  indoor_cycling: "cycling",
  paddelball: "cycling",
  swimming: "swimming",
  lap_swimming: "swimming",
  open_water_swimming: "swimming",
  strength_training: "strength",
  hiking: "hiking",
  walking: "walking",
  other: "other",
  breathwork: "other",
  assistance: "other",
  resort_skiing: "other",
  tennis_v2: "other",
  elliptical: "other",
};

export const SPORT_COLORS: Record<SportCategory, string> = {
  running: "#f472b6",
  cycling: "#facc15",
  swimming: "#60a5fa",
  strength: "#a1a1aa",
  hiking: "#4ade80",
  walking: "#a78bfa",
  other: "#6b7280",
};

export const SPORT_LABELS: Record<SportCategory, string> = {
  running: "Carrera",
  cycling: "Bicicleta",
  swimming: "Natación",
  strength: "Fuerza",
  hiking: "Senderismo",
  walking: "Caminar",
  other: "Otros",
};

export interface Session {
  schema_version: number;
  id: string;
  sport: string;
  name: string;
  start_date_local: string;
  distance_m?: number;
  moving_time_s?: number;
  elapsed_time_s?: number;
  avg_speed_ms?: number;
  avg_pace_s_per_km?: number;
  max_speed_ms?: number;
  avg_heartrate?: number;
  max_heartrate?: number;
  avg_watts?: number;
  max_watts?: number;
  total_elevation_gain_m?: number;
  average_temp_c?: number;
  training_effect?: number;
  calories_kcal?: number;
  segments?: SessionSegment[];
  best_efforts?: SessionBestEffort[];
}

export interface SessionSegment {
  distance_m?: number;
  time_s?: number;
  avg_pace_s_per_km?: number;
  avg_heartrate?: number;
  max_heartrate?: number;
}

export interface SessionBestEffort {
  name: string;
  distance_m: number;
  elapsed_time_s: number;
}

export interface PlannedSession {
  id: string;
  sport: SportCategory;
  name: string;
  date: string;
  duration_min?: number;
  distance_km?: number;
  notes?: string;
  status: "planned" | "completed";
}

export interface SessionWithStatus extends Session {
  status: "completed" | "planned";
}

export interface FilterState {
  sport: SportCategory | "all";
  dateFrom: string | null;
  dateTo: string | null;
  showCompleted: boolean;
  showPlanned: boolean;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  sessions: number;
  hours: number;
  distance_km: number;
  elevation_m: number;
  bySport: Record<SportCategory, number>;
  plannedSessions: number;
  plannedDistance_km: number;
  plannedHours: number;
}

export interface Goal {
  week: number;
  label: string;
  subtitle: string;
  date: string;
  targetPace?: string;
  daysRemaining: number;
  progress: number;
  status: "upcoming" | "current" | "completed";
}

export interface StatItem {
  label: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
}