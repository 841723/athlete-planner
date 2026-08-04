import { useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import {
  formatDuration,
  formatNumber,
  getSportCategory,
  getWeekNumber,
} from "@/lib/utils";
import type { Session, SportCategory } from "@/types/session";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  sub?: string;
  max?: string;
}

function StatCard({ label, value, icon, sub, max }: StatCardProps) {
  return (
    <div className="card card-hover p-5">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <div className="stat-label mb-1">{label}</div>
      <div className="stat-value">{value}</div>
      {max && (
        <div className="mt-1 text-xs font-semibold text-gray-500">MAX {max}</div>
      )}
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold mt-8 mb-4 first:mt-0">{children}</h2>
  );
}

function formatPaceShort(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatPace100(secPer100m: number): string {
  const min = Math.floor(secPer100m / 60);
  const sec = Math.round(secPer100m % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function avg(list: number[]): number | null {
  if (list.length === 0) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

interface SportStats {
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

function buildSportStats(
  cat: SportCategory,
  list: Session[],
  all: Session[],
  speedMaxSessions?: Session[]
): SportStats {
  const dist = list.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
  const hours = list.reduce((sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600, 0);
  const durations = list.map((s) => s.moving_time_s ?? s.elapsed_time_s ?? 0);
  const avgDur = avg(durations);
  const maxDur = durations.length > 0 ? Math.max(...durations) : null;
  const hrList = list.filter((s) => s.avg_heartrate).map((s) => s.avg_heartrate!);
  const maxHrList = list.filter((s) => s.max_heartrate).map((s) => s.max_heartrate!);

  const withDist = list.filter((s) => s.distance_m && s.moving_time_s);
  const distances = withDist.map((s) => s.distance_m! / 1000);
  const paces = withDist.map((s) => (s.moving_time_s! / s.distance_m!) * 1000);
  const speeds = withDist.map((s) => (s.distance_m! / s.moving_time_s!) * 3.6);
  const paces100 = withDist.map((s) => (s.moving_time_s! / s.distance_m!) * 100);

  const speedMaxPool = speedMaxSessions ?? list;
  const speedMaxList = speedMaxPool
    .filter((s) => s.max_speed_ms != null && s.max_speed_ms > 0)
    .map((s) => s.max_speed_ms! * 3.6);

  const wattsList = list.filter((s) => s.avg_watts).map((s) => s.avg_watts!);
  const maxWatts = list.reduce((m, s) => Math.max(m, s.max_watts ?? 0), 0);

  const elevList = list.filter((s) => s.total_elevation_gain_m).map((s) => s.total_elevation_gain_m!);

  const totalHours = Math.max(
    0.0001,
    all.reduce((sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600, 0)
  );

  return {
    cat,
    sessions: list.length,
    sessionsPct: all.length > 0 ? (list.length / all.length) * 100 : 0,
    hours,
    hoursPct: (hours / totalHours) * 100,
    distanceKm: dist / 1000,
    avgDistanceKm: withDist.length > 0 ? dist / 1000 / withDist.length : null,
    maxDistanceKm: distances.length > 0 ? Math.max(...distances) : null,
    avgDurationSec: avgDur,
    maxDurationSec: maxDur,
    avgHr: avg(hrList),
    maxHr: maxHrList.length > 0 ? Math.max(...maxHrList) : null,
    avgPaceSecPerKm: avg(paces),
    bestPaceSecPerKm: paces.length > 0 ? Math.min(...paces) : null,
    avgSpeedKmh: avg(speeds),
    maxSpeedKmh: speedMaxList.length > 0 ? Math.max(...speedMaxList) : null,
    avgWatts: avg(wattsList),
    maxWatts: maxWatts > 0 ? maxWatts : null,
    avgPace100: avg(paces100),
    bestPace100: paces100.length > 0 ? Math.min(...paces100) : null,
    avgElevationGain: avg(elevList),
    maxElevationGain: elevList.length > 0 ? Math.max(...elevList) : null,
  };
}

const RODILLO_SPORTS = new Set(["virtual_ride", "indoor_cycling"]);

export function StatsGrid() {
  const { data, isLoading } = useSessions();

  const stats = useMemo(() => {
    if (!data) return null;
    const all = [...data.completed];

    const sportSessions: Record<SportCategory, Session[]> = {
      running: [], cycling: [], swimming: [], strength: [], hiking: [], walking: [], padel: [], other: [],
    };
    for (const s of all) {
      sportSessions[getSportCategory(s.sport)].push(s);
    }

    const cyclingOutdoor = sportSessions.cycling.filter((s) => !RODILLO_SPORTS.has(s.sport));

    const totalDistance = all.reduce((sum, s) => sum + (s.distance_m ?? 0), 0);
    const totalHours = all.reduce((sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600, 0);
    const totalElevation = all.reduce((sum, s) => sum + (s.total_elevation_gain_m ?? 0), 0);
    const totalCalories = all.reduce((sum, s) => sum + (s.calories_kcal ?? 0), 0);
    const totalMovingSec = all.reduce((sum, s) => sum + (s.moving_time_s ?? s.elapsed_time_s ?? 0), 0);

    const bySport: Record<SportCategory, SportStats> = {
      running: buildSportStats("running", sportSessions.running, all),
      cycling: buildSportStats("cycling", sportSessions.cycling, all, cyclingOutdoor),
      swimming: buildSportStats("swimming", sportSessions.swimming, all),
      strength: buildSportStats("strength", sportSessions.strength, all),
      hiking: buildSportStats("hiking", sportSessions.hiking, all),
      walking: buildSportStats("walking", sportSessions.walking, all),
      padel: buildSportStats("padel", sportSessions.padel, all),
      other: buildSportStats("other", sportSessions.other, all),
    };

    const hrZoneSeconds: Record<number, number> = {};
    for (const s of all) {
      for (const z of s.hr_zones ?? []) {
        hrZoneSeconds[z.zoneNumber] = (hrZoneSeconds[z.zoneNumber] ?? 0) + z.secsInZone;
      }
    }
    const dominantZone = Object.entries(hrZoneSeconds).sort(([, a], [, b]) => b - a)[0];

    const bestEfforts: Record<string, { name: string; time_s: number }> = {};
    for (const s of all) {
      for (const e of s.best_efforts ?? []) {
        const key = e.name;
        if (!bestEfforts[key] || e.elapsed_time_s < bestEfforts[key].time_s) {
          bestEfforts[key] = { name: e.name, time_s: e.elapsed_time_s };
        }
      }
    }

    const dates = new Set(all.map((s) => s.start_date_local.slice(0, 10)));
    const sortedDates = [...dates].sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    let streak = 0;
    let cursor = new Date();
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    }

    let longestStreak = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const d of sortedDates) {
      const date = new Date(`${d}T00:00:00`);
      if (prev && Math.round((date.getTime() - prev.getTime()) / 86400000) === 1) {
        run++;
      } else {
        run = 1;
      }
      longestStreak = Math.max(longestStreak, run);
      prev = date;
    }

    const weeksSet = new Set<number>();
    for (const s of all) {
      weeksSet.add(getWeekNumber(new Date(s.start_date_local)));
    }
    const activeWeeks = weeksSet.size;

    const tempList = all.filter((s) => s.average_temp_c).map((s) => s.average_temp_c!);
    const avgTemp = avg(tempList);
    const teList = all.filter((s) => s.training_effect != null).map((s) => s.training_effect!);
    const avgTe = avg(teList);
    const totalTe = teList.reduce((a, b) => a + b, 0);
    const avgRpe = avg(all.filter((s) => s.rpe != null).map((s) => s.rpe!));
    const avgFeel = avg(all.filter((s) => s.feel != null).map((s) => s.feel!));
    const rpeCount = all.filter((s) => s.rpe != null).length;

    return {
      totals: {
        totalDistance, totalHours, totalElevation, totalCalories,
        totalMovingSec, totalSessions: all.length,
        distPerSession: all.length > 0 ? totalDistance / 1000 / all.length : null,
        kcalPerSession: all.length > 0 ? totalCalories / all.length : null,
      },
      bySport,
      global: {
        dominantZone, bestEfforts, avgTemp, avgTe, totalTe,
        avgRpe, avgFeel, rpeCount,
        streak, longestStreak, activeWeeks,
        avgHr: avg(all.filter((s) => s.avg_heartrate).map((s) => s.avg_heartrate!)),
        maxHr: all.reduce((m, s) => Math.max(m, s.max_heartrate ?? 0), 0),
        maxWatts: all.reduce((m, s) => Math.max(m, s.max_watts ?? 0), 0),
        avgSessionsPerWeek: activeWeeks > 0 ? all.length / activeWeeks : null,
        avgHoursPerWeek: activeWeeks > 0 ? totalHours / activeWeeks : null,
        avgDistancePerWeek: activeWeeks > 0 ? totalDistance / 1000 / activeWeeks : null,
      },
      dates: { firstDate, lastDate },
    };
  }, [data]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { totals, bySport, global, dates } = stats;

  const bestEffortRows = Object.entries(global.bestEfforts).sort(([a], [b]) => {
    const order = ["1K", "1 Mile", "5K", "10K", "Half Marathon", "Marathon"];
    return order.indexOf(a) - order.indexOf(b);
  });

  const sportIcon: Record<SportCategory, string> = {
    running: "🏃", cycling: "🚴", swimming: "🏊", strength: "🏋️", hiking: "🥾", walking: "🚶", padel: "🎾", other: "🎽",
  };

  const running = bySport.running;
  const cycling = bySport.cycling;
  const swimming = bySport.swimming;
  const strength = bySport.strength;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-2">Estadísticas</h1>
      <p className="text-sm text-gray-500 mb-6">
        {dates.firstDate ? `Desde el ${dates.firstDate} hasta el ${dates.lastDate}` : ""} ·{" "}
        {formatNumber(totals.totalSessions)} sesiones completadas · {global.activeWeeks} semanas activas
      </p>

      <SectionTitle>Totales</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Km totales" value={`${formatNumber(totals.totalDistance / 1000, 1)} km`} icon="📏" />
        <StatCard label="Horas totales" value={formatDuration(totals.totalMovingSec)} icon="⏱️" />
        <StatCard label="Sesiones" value={formatNumber(totals.totalSessions)} icon="📊" />
        <StatCard label="Calorías" value={`${formatNumber(totals.totalCalories)} kcal`} icon="🔥" />
        <StatCard label="Desnivel total" value={`${formatNumber(totals.totalElevation)} m`} icon="⛰️" />
        <StatCard label="Media distancia/sesión" value={`${formatNumber(totals.distPerSession, 2)} km`} max={bySport.running.maxDistanceKm ? `${formatNumber(bySport.running.maxDistanceKm, 1)} km` : undefined} icon="📐" />
        <StatCard label="Duración media" value={formatDuration(totals.totalMovingSec / Math.max(1, totals.totalSessions))} icon="⏳" />
        <StatCard label="Kcal por sesión" value={`${formatNumber(totals.kcalPerSession)} kcal`} icon="🍎" />
      </div>

      <SectionTitle>Intensidad y volumen</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="FC media global" value={global.avgHr ? `${formatNumber(global.avgHr)} ppm` : "—"} max={global.maxHr ? `${formatNumber(global.maxHr)} ppm` : undefined} icon="❤️" />
        <StatCard label="Sesiones/semana" value={formatNumber(global.avgSessionsPerWeek, 1)} icon="📅" />
        <StatCard label="Horas/semana" value={`${formatNumber(global.avgHoursPerWeek, 1)} h`} icon="⏱️" />
        <StatCard label="Km/semana" value={`${formatNumber(global.avgDistancePerWeek, 1)} km`} icon="📏" />
        <StatCard label="TE total" value={formatNumber(global.totalTe, 1)} sub="Training effect acumulado" icon="📈" />
        <StatCard label="TE medio" value={global.avgTe ? formatNumber(global.avgTe, 1) : "—"} icon="📈" />
        <StatCard label="RPE medio" value={global.avgRpe ? `${formatNumber(global.avgRpe)} / 100` : "—"} sub={global.rpeCount ? `${formatNumber(global.rpeCount)} autoevaluaciones` : undefined} icon="😮‍💨" />
        <StatCard label="Sensación media" value={global.avgFeel ? `${formatNumber(global.avgFeel)} / 100` : "—"} icon="😊" />
        <StatCard label="Temp. media" value={global.avgTemp ? `${formatNumber(global.avgTemp)}°C` : "—"} icon="🌡️" />
        <StatCard label="Racha" value={`${global.streak} días`} sub={`Récord: ${global.longestStreak} días`} icon="🔥" />
      </div>

      <SectionTitle>Carrera</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sesiones" value={formatNumber(running.sessions)} sub={`${formatNumber(running.sessionsPct)}% del total`} icon="🏃" />
        <StatCard label="Tiempo dedicado" value={formatDuration(running.hours * 3600)} sub={`${formatNumber(running.hoursPct)}% del volumen`} icon="⏱️" />
        <StatCard label="Distancia total" value={`${formatNumber(running.distanceKm, 1)} km`} icon="📏" />
        <StatCard label="Distancia media" value={running.avgDistanceKm ? `${formatNumber(running.avgDistanceKm, 2)} km` : "—"} max={running.maxDistanceKm ? `${formatNumber(running.maxDistanceKm, 1)} km` : undefined} icon="📐" />
        <StatCard label="Ritmo medio" value={running.avgPaceSecPerKm ? `${formatPaceShort(running.avgPaceSecPerKm)} /km` : "—"} max={running.bestPaceSecPerKm ? `${formatPaceShort(running.bestPaceSecPerKm)} /km` : undefined} icon="⏱️" />
        <StatCard label="FC media" value={running.avgHr ? `${formatNumber(running.avgHr)} ppm` : "—"} max={running.maxHr ? `${formatNumber(running.maxHr)} ppm` : undefined} icon="❤️" />
        <StatCard label="Duración media" value={running.avgDurationSec ? formatDuration(running.avgDurationSec) : "—"} max={running.maxDurationSec ? formatDuration(running.maxDurationSec) : undefined} icon="⏳" />
        <StatCard label="Desnivel medio" value={running.avgElevationGain != null ? `${formatNumber(running.avgElevationGain)} m` : "—"} max={running.maxElevationGain != null ? `${formatNumber(running.maxElevationGain)} m` : undefined} icon="⛰️" />
      </div>

      <SectionTitle>Bicicleta</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sesiones" value={formatNumber(cycling.sessions)} sub={`${formatNumber(cycling.sessionsPct)}% del total`} icon="🚴" />
        <StatCard label="Tiempo dedicado" value={formatDuration(cycling.hours * 3600)} sub={`${formatNumber(cycling.hoursPct)}% del volumen`} icon="⏱️" />
        <StatCard label="Distancia total" value={`${formatNumber(cycling.distanceKm, 1)} km`} icon="📏" />
        <StatCard label="Distancia media" value={cycling.avgDistanceKm ? `${formatNumber(cycling.avgDistanceKm, 1)} km` : "—"} max={cycling.maxDistanceKm ? `${formatNumber(cycling.maxDistanceKm, 1)} km` : undefined} icon="📐" />
        <StatCard label="Velocidad media" value={cycling.avgSpeedKmh ? `${formatNumber(cycling.avgSpeedKmh, 1)} km/h` : "—"} max={cycling.maxSpeedKmh ? `${formatNumber(cycling.maxSpeedKmh, 1)} km/h` : undefined} sub="Máx sin rodillo" icon="⚡" />
        <StatCard label="Potencia media" value={cycling.avgWatts ? `${formatNumber(cycling.avgWatts)} W` : "—"} max={cycling.maxWatts ? `${formatNumber(cycling.maxWatts)} W` : undefined} icon="⚡" />
        <StatCard label="FC media" value={cycling.avgHr ? `${formatNumber(cycling.avgHr)} ppm` : "—"} max={cycling.maxHr ? `${formatNumber(cycling.maxHr)} ppm` : undefined} icon="❤️" />
        <StatCard label="Duración media" value={cycling.avgDurationSec ? formatDuration(cycling.avgDurationSec) : "—"} max={cycling.maxDurationSec ? formatDuration(cycling.maxDurationSec) : undefined} icon="⏳" />
        <StatCard label="Desnivel medio" value={cycling.avgElevationGain != null ? `${formatNumber(cycling.avgElevationGain)} m` : "—"} max={cycling.maxElevationGain != null ? `${formatNumber(cycling.maxElevationGain)} m` : undefined} icon="⛰️" />
      </div>

      <SectionTitle>Natación</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sesiones" value={formatNumber(swimming.sessions)} sub={`${formatNumber(swimming.sessionsPct)}% del total`} icon="🏊" />
        <StatCard label="Tiempo dedicado" value={formatDuration(swimming.hours * 3600)} sub={`${formatNumber(swimming.hoursPct)}% del volumen`} icon="⏱️" />
        <StatCard label="Distancia total" value={`${formatNumber(swimming.distanceKm, 2)} km`} icon="📏" />
        <StatCard label="Distancia media" value={swimming.avgDistanceKm ? `${formatNumber(swimming.avgDistanceKm, 3)} km` : "—"} max={swimming.maxDistanceKm ? `${formatNumber(swimming.maxDistanceKm, 3)} km` : undefined} icon="📐" />
        <StatCard label="Ritmo medio" value={swimming.avgPace100 ? `${formatPace100(swimming.avgPace100)} /100m` : "—"} max={swimming.bestPace100 ? `${formatPace100(swimming.bestPace100)} /100m` : undefined} icon="⏱️" />
        <StatCard label="FC media" value={swimming.avgHr ? `${formatNumber(swimming.avgHr)} ppm` : "—"} max={swimming.maxHr ? `${formatNumber(swimming.maxHr)} ppm` : undefined} icon="❤️" />
        <StatCard label="Duración media" value={swimming.avgDurationSec ? formatDuration(swimming.avgDurationSec) : "—"} max={swimming.maxDurationSec ? formatDuration(swimming.maxDurationSec) : undefined} icon="⏳" />
      </div>

      <SectionTitle>Fuerza</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sesiones" value={formatNumber(strength.sessions)} sub={`${formatNumber(strength.sessionsPct)}% del total`} icon="🏋️" />
        <StatCard label="Tiempo dedicado" value={formatDuration(strength.hours * 3600)} sub={`${formatNumber(strength.hoursPct)}% del volumen`} icon="⏱️" />
        <StatCard label="Duración media" value={strength.avgDurationSec ? formatDuration(strength.avgDurationSec) : "—"} max={strength.maxDurationSec ? formatDuration(strength.maxDurationSec) : undefined} icon="⏳" />
        <StatCard label="FC media" value={strength.avgHr ? `${formatNumber(strength.avgHr)} ppm` : "—"} max={strength.maxHr ? `${formatNumber(strength.maxHr)} ppm` : undefined} icon="❤️" />
      </div>

      {global.dominantZone && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-8">
          <StatCard
            label="Zona de FC dominante"
            value={`Zona ${global.dominantZone[0]}`}
            sub={`${formatNumber(Number(global.dominantZone[1]) / 3600, 1)} h en zona`}
            icon="❤️"
          />
        </div>
      )}

      <SectionTitle>Mejores marcas (best efforts)</SectionTitle>
      {bestEffortRows.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {bestEffortRows.map(([name, entry]) => {
            const distKm = name.startsWith("1 Mile") ? 1.609 : parseFloat(name);
            const pacePerKm = distKm > 0 ? entry.time_s / distKm : 0;
            return (
              <StatCard
                key={name}
                label={`Mejor ${entry.name}`}
                value={formatDuration(entry.time_s)}
                sub={distKm > 0 ? `${formatPaceShort(pacePerKm)} min/km` : undefined}
                icon="🏅"
              />
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Sin mejores marcas registradas.</p>
      )}
    </div>
  );
}
