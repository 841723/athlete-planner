import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/date-format";
import { Save, Loader2, ExternalLink, X } from "lucide-react";
import type { Session } from "@/types/session";
import { getSportColor, getSportLabel, formatDistance, formatDuration, formatPace, formatSpeed, formatFullDate } from "@/lib/utils";
import { useUpdateSession } from "@/hooks/use-update-session";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface SessionModalProps {
  session: Session;
  onClose: () => void;
}

function intensityBadge(intensity: string): { label: string; className: string } {
  switch (intensity) {
    case "ACTIVE":
      return { label: "Serie", className: "bg-accent/20 text-accent-light" };
    case "REST":
      return { label: "Recuperación", className: "bg-dark-400/50 text-gray-300" };
    case "WARMUP":
      return { label: "Calentamiento", className: "bg-yellow-500/15 text-yellow-400" };
    case "COOLDOWN":
      return { label: "Vuelta a la calma", className: "bg-sky-500/15 text-sky-400" };
    default:
      return { label: "Lap", className: "bg-dark-400/50 text-gray-300" };
  }
}

export function SessionModal({ session, onClose }: SessionModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenantId } = useAuth();
  const color = getSportColor(session.category);
  const label = getSportLabel(session.category);
  const updateMutation = useUpdateSession();
  const [notes, setNotes] = useState(session.notes ?? "");
  const [isEditing, setIsEditing] = useState(false);

  function handleSaveNotes() {
    updateMutation.mutate(
      { id: session.id, payload: { notes } },
      { onSuccess: () => setIsEditing(false) }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div className="card p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-xl font-bold">{session.title ?? session.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {session.title && session.title !== session.name && (
          <p className="text-xs text-gray-500 -mt-3 mb-4">{session.name}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoItem label="Fecha" value={formatFullDate(session.start_date_local)} />
          <InfoItem label="Hora" value={format(parseISO(session.start_date_local), "HH:mm")} />
          <InfoItem label="Deporte" value={label} />
          <InfoItem label="Duración" value={(() => { const t = session.time_s ?? 0; return t > 0 ? `${(t / 60).toFixed(0)} min` : "—"; })()} />
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
          {session.rpe != null && <InfoItem label="RPE" value={`${session.rpe} / 100`} />}
          {session.feel != null && <InfoItem label="Sensación" value={`${session.feel} / 100`} />}
          {session.average_temp_c && <InfoItem label="Temperatura" value={`${session.average_temp_c}°C`} />}
        </div>

        {session.segments && session.segments.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">
              Segmentos
              <span className="text-gray-500 font-normal ml-1">({session.segments.length})</span>
            </h4>
            <div className="space-y-2">
              {session.segments.map((seg, i) => {
                const badge = intensityBadge(seg.intensity ?? "Lap");
                return (
                  <div key={i} className="text-sm p-2.5 rounded-lg bg-dark-300/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-gray-400">{i + 1}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                      <SegStat label="Distancia" value={seg.distance_m ? formatDistance(seg.distance_m) : "—"} />
                      <SegStat label="Tiempo" value={seg.time_s ? formatDuration(seg.time_s) : "—"} />
                      <SegStat label="Ritmo" value={seg.avg_pace_s_per_km ? formatPace(seg.avg_pace_s_per_km) : seg.avg_speed_ms ? formatSpeed(seg.avg_speed_ms) : "—"} />
                      <SegStat label="FC" value={seg.avg_heartrate ? `${seg.avg_heartrate}${seg.max_heartrate ? `/${seg.max_heartrate}` : ""} bpm` : "—"} />
                      <SegStat label="Potencia" value={seg.avg_watts ? `${seg.avg_watts}${seg.max_watts ? `/${seg.max_watts}` : ""} W` : "—"} />
                      <SegStat label="Desnivel" value={seg.total_elevation_gain_m ? `${seg.total_elevation_gain_m} m` : "—"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {session.hr_zones && session.hr_zones.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Tiempo por zonas de FC</h4>
            <div className="flex items-end gap-1 h-20">
              {session.hr_zones.map((z) => {
                const total = session.hr_zones!.reduce((s, x) => s + x.secsInZone, 0) || 1;
                const pct = (z.secsInZone / total) * 100;
                return (
                  <div key={z.zoneNumber} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-[10px] text-gray-400">{formatDuration(z.secsInZone)}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-accent/30 to-accent-light"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="text-[10px] text-gray-500">Z{z.zoneNumber}</span>
                  </div>
                );
              })}
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

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-300">Comentarios</h4>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-accent hover:text-accent-light"
              >
                Editar
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              <AutoTextarea
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                minRows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Añade tus comentarios sobre esta sesión..."
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1"
                  onClick={() => {
                    setNotes(session.notes ?? "");
                    setIsEditing(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="text-xs px-2 py-1"
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 whitespace-pre-wrap">
              {notes || "Sin comentarios"}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-dark-400">
          <button
            onClick={() => {
              onClose();
              navigate(tenantPath(activeTenantId, `/session/${session.id}`), { state: { from: location.pathname } });
            }}
            className="btn btn-ghost text-sm"
          >
            <ExternalLink className="w-4 h-4" /> Ver página completa
          </button>
          <a
            href={`https://connect.garmin.com/modern/activity/${session.external_id ?? session.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-sm"
          >
            Garmin
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

function SegStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between sm:flex-col sm:justify-start text-xs">
      <span className="text-gray-500 sm:mb-0.5">{label}</span>
      <span className="font-medium text-gray-200">{value}</span>
    </div>
  );
}
