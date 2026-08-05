export type SportCategory =
  | "running"
  | "cycling"
  | "swimming"
  | "strength"
  | "hiking"
  | "walking"
  | "padel"
  | "other";

export const SPORT_COLORS: Record<SportCategory, string> = {
  running: "#f472b6",
  cycling: "#facc15",
  swimming: "#60a5fa",
  strength: "#a1a1aa",
  hiking: "#4ade80",
  walking: "#a78bfa",
  padel: "#84cc16",
  other: "#6b7280",
};

export const SPORT_LABELS: Record<SportCategory, string> = {
  running: "Carrera",
  cycling: "Bicicleta",
  swimming: "Natación",
  strength: "Fuerza",
  hiking: "Senderismo",
  walking: "Caminar",
  padel: "Padel",
  other: "Otros",
};

export interface Session {
  schema_version: number;
  id: string;
  sport: string;
  name: string;
  title?: string;
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
  total_elevation_loss_m?: number;
  average_temp_c?: number;
  training_effect?: number;
  calories_kcal?: number;
  rpe?: number;
  feel?: number;
  notes?: string;
  segments?: SessionSegment[];
  best_efforts?: SessionBestEffort[];
  hr_zones?: HrZone[];
  workout?: PlannedWorkout;
  hr_from?: number;
  hr_to?: number;
  category?: SportCategory;
  time_s?: number;
  weekNumber?: number | null;
  objectives?: ObjectiveLine[];
}

export interface SessionSegment {
  distance_m?: number;
  time_s?: number;
  avg_speed_ms?: number;
  avg_pace_s_per_km?: number;
  max_speed_ms?: number;
  avg_heartrate?: number;
  max_heartrate?: number;
  avg_watts?: number;
  max_watts?: number;
  total_elevation_gain_m?: number;
  intensity?: "ACTIVE" | "REST" | "WARMUP" | "COOLDOWN" | string;
}

export interface HrZone {
  zoneNumber: number;
  zoneLowBoundary: number;
  secsInZone: number;
}

export interface WorkoutBlock {
  type?: "steady" | "intervals";
  repeat?: number;
  distance_m?: number;
  time_s?: number;
  pace_s_per_km?: number;
  rest_s?: number;
  hr_from?: number;
  hr_to?: number;
}

export interface PlannedWorkout {
  warmup_s?: number;
  cooldown_s?: number;
  blocks?: WorkoutBlock[];
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

export interface ObjectiveLine {
  label?: string;
  text: string;
}

export interface RaceGoal {
  week: number;
  label: string;
  date: string;
  targetPace?: string;
}

export interface MetaData {
  trainingWeekOneStart: string;
  planStart: string;
  goalDate: string;
}

export interface SessionTotals {
  totalDistance: number;
  totalHours: number;
  totalSessions: number;
}

export interface SessionTotalsCompleted {
  totalDistance: number;
  totalHours: number;
}

export interface SessionsResponse {
  completed: Session[];
  planned: Session[];
  totals: SessionTotals;
  totalsCompleted: SessionTotalsCompleted;
}

export interface PlannedSessionView extends Session {
  category: SportCategory;
  time_s: number;
  weekNumber: number | null;
  objectives: ObjectiveLine[];
}

export interface StatsTotals {
  totalDistance: number;
  totalHours: number;
  totalElevation: number;
  totalCalories: number;
  totalMovingSec: number;
  totalSessions: number;
  distPerSession: number | null;
  kcalPerSession: number | null;
}

export interface SportStats {
  cat: SportCategory;
  sessions: number;
  sessionsPct: number;
  hours: number;
  hoursPct: number;
  distanceKm: number;
  avgDistanceKm: number | null;
  maxDistanceKm: number | null;
  avgDurationSec: number | null;
  maxDurationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPaceSecPerKm: number | null;
  bestPaceSecPerKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgWatts: number | null;
  maxWatts: number | null;
  avgPace100: number | null;
  bestPace100: number | null;
  avgElevationGain: number | null;
  maxElevationGain: number | null;
}

export interface StatsGlobal {
  dominantZone?: [string, number];
  bestEfforts: Record<string, { name: string; time_s: number }>;
  avgTemp: number | null;
  avgTe: number | null;
  totalTe: number;
  avgRpe: number | null;
  avgFeel: number | null;
  rpeCount: number;
  streak: number;
  longestStreak: number;
  activeWeeks: number;
  avgHr: number | null;
  maxHr: number;
  maxWatts: number;
  avgSessionsPerWeek: number | null;
  avgHoursPerWeek: number | null;
  avgDistancePerWeek: number | null;
}

export interface StatsData {
  totals: StatsTotals;
  bySport: Record<SportCategory, SportStats>;
  global: StatsGlobal;
  dates: { firstDate?: string; lastDate?: string };
}

export interface ChartsData {
  weeklyHours: { week: string; hours: number }[];
  trainingLoad: { week: string; load: number }[];
  volumeEvolution: { date: string; hours: number; distance: number }[];
  cumulativeDistance: { date: string; cumulative: number }[];
  distanceBySport: Record<string, number | string>[];
  runningPaces: { date: string; pace: number }[];
  cyclingSpeeds: { date: string; speed: number }[];
  swimMinutes: { date: string; minutes: number }[];
  weekChart: { week: string; hours: number; planned: number; distance: number }[];
  sportDistribution: { sport: string; value: number }[];
}

export interface GeneratePlanRequest {
  comments: string;
  weeks: number;
}

export interface GeneratePlanResponse {
  comments: string;
  sessions: PlannedSessionView[];
}

export interface SyncResult {
  synced: number;
  skipped: number;
  filtered: number;
  missing: number;
  ids: string[];
  message?: string;
}

export interface StatRecord {
  id: string;
  icon: string;
  label: string;
  display: string;
  value?: number;
  sessionId?: string;
  sessionName?: string;
  sessionDate?: string;
}

export interface BestEffortRecord {
  name: string;
  distance_m: number;
  time_s: number;
  sessionId: string;
  sessionName: string;
  sessionDate: string;
}

export interface StatsRecordsData {
  records: StatRecord[];
  bestEfforts: {
    running: BestEffortRecord[];
    cycling: BestEffortRecord[];
    swimming: BestEffortRecord[];
  };
}