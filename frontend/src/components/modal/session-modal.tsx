import { format, parseISO } from "date-fns";
import type { Session } from "@/types/session";
import { getSportColor, getSportLabel, formatDistance, formatDuration, formatPace, formatSpeed } from "@/lib/utils";

interface SessionModalProps {
  session: Session;
  onClose: () => void;
}

export function SessionModal({ session, onClose }: SessionModalProps) {
  const color = getSportColor(session.sport);
  const label = getSportLabel(session.sport);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div className="card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-xl font-bold">{session.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoItem label="Fecha" value={format(parseISO(session.start_date_local), "d MMM yyyy")} />
          <InfoItem label="Hora" value={format(parseISO(session.start_date_local), "HH:mm")} />
          <InfoItem label="Deporte" value={label} />
          <InfoItem label="Duración" value={session.moving_time_s ? `${(session.moving_time_s / 60).toFixed(0)} min` : "—"} />
          {session.distance_m && <InfoItem label="Distancia" value={formatDistance(session.distance_m)} />}
          {session.total_elevation_gain_m && <InfoItem label="Desnivel" value={`${session.total_elevation_gain_m} m`} />}
          {session.calories_kcal && <InfoItem label="Calorías" value={`${session.calories_kcal} kcal`} />}
          {session.avg_heartrate && <InfoItem label="FC media" value={`${session.avg_heartrate} bpm`} />}
          {session.max_heartrate && <InfoItem label="FC máx" value={`${session.max_heartrate} bpm`} />}
          {session.avg_watts && <InfoItem label="Potencia media" value={`${session.avg_watts} W`} />}
          {session.max_watts && <InfoItem label="Potencia máx" value={`${session.max_watts} W`} />}
          {session.avg_speed_ms && <InfoItem label="Velocidad" value={formatSpeed(session.avg_speed_ms)} />}
          {session.avg_pace_s_per_km && <InfoItem label="Ritmo" value={formatPace(session.avg_pace_s_per_km)} />}
          {session.training_effect && <InfoItem label="Efecto entrenamiento" value={`${session.training_effect}`} />}
          {session.average_temp_c && <InfoItem label="Temperatura" value={`${session.average_temp_c}°C`} />}
        </div>

        {session.segments && session.segments.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Segmentos</h4>
            <div className="space-y-2">
              {session.segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-dark-300/50">
                  <span className="text-gray-400 w-16">Lap {i + 1}</span>
                  <span className="flex-1">{seg.distance_m ? formatDistance(seg.distance_m) : "—"}</span>
                  <span>{seg.time_s ? formatDuration(seg.time_s) : "—"}</span>
                  {seg.avg_heartrate && <span className="text-gray-500">{seg.avg_heartrate} bpm</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {session.best_efforts && session.best_efforts.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Mejores esfuerzos</h4>
            <div className="flex gap-2 flex-wrap">
              {session.best_efforts.map((effort, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg bg-dark-300/50 text-sm">
                  <span className="font-medium">{effort.name}</span>
                  <span className="text-gray-400 ml-2">{formatDistance(effort.distance_m)} · {formatDuration(effort.elapsed_time_s)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-dark-400">
          <a
            href={`https://connect.garmin.com/modern/activity/${session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary text-sm"
          >
            Ver en Garmin
          </a>
          <a
            href={`https://www.strava.com/activities/${session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-sm"
          >
            Ver en Strava
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}