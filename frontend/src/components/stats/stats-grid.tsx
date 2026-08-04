import { useStats } from "@/hooks/use-stats";
import { formatDuration, formatNumber } from "@/lib/utils";
import type { SportCategory } from "@/types/session";
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

export function StatsGrid() {
  const { data: stats, isLoading } = useStats();

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
