import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { useCreateManualSession } from "@/hooks/use-manual-session";
import { localDateKey } from "@/lib/utils";
import type { Session, SessionSegment } from "@/types/session";

type Lap = {
  label: string;
  duration: string;
  distance: string;
  pace: string;
  speed: string;
  hr: string;
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
};

const SPORTS = [
  ["running", "Carrera"], ["cycling", "Bicicleta"], ["lap_swimming", "Natación piscina"],
  ["open_water_swimming", "Natación aguas abiertas"], ["strength_training", "Fuerza / Calistenia"],
  ["paddelball", "Padel"], ["hiking", "Senderismo"], ["walking", "Caminar"], ["other", "Otros"],
] as const;
const LABELS = ["Calentamiento", "Serie", "Trabajo", "Recuperación", "Enfriamiento", "Libre"];
const emptyLap = (): Lap => ({ label: "Serie", duration: "", distance: "", pace: "", speed: "", hr: "", exercise: "", sets: "", reps: "", weight: "" });

function parsePace(value: string): number | undefined {
  const match = value.trim().match(/^(\d+)(?::(\d{1,2}))?/);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  const seconds = Number(match[2] ?? 0);
  return minutes * 60 + seconds;
}

function intensity(label: string): string | undefined {
  if (/calent/i.test(label)) return "WARMUP";
  if (/enfri/i.test(label)) return "COOLDOWN";
  if (/recuper/i.test(label)) return "REST";
  if (/serie|trabajo/i.test(label)) return "ACTIVE";
  return undefined;
}

interface Props {
  open: boolean;
  defaultDate?: string;
  onClose: () => void;
}

export function ManualActivityModal({ open, defaultDate, onClose }: Props) {
  const mutation = useCreateManualSession();
  const [sport, setSport] = useState("running");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [laps, setLaps] = useState<Lap[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSport("running");
    setTitle("");
    setDate(defaultDate ?? localDateKey());
    setTime("07:00");
    setDuration("");
    setDistance("");
    setNotes("");
    setLaps([]);
    setError(null);
  }, [open, defaultDate]);

  if (!open) return null;
  const strength = sport === "strength_training";
  const swim = sport.includes("swimming");
  const cycling = sport.includes("cycling") || sport === "cycling";
  const distanceUnit = swim ? "m" : "km";
  const field = "w-full rounded-lg border border-dark-400 bg-dark-300/50 px-3 py-2 text-sm focus:border-accent/60 focus:outline-none";

  function updateLap(index: number, key: keyof Lap, value: string) {
    setLaps((current) => current.map((lap, i) => i === index ? { ...lap, [key]: value } : lap));
  }

  function buildSegments(): SessionSegment[] {
    return laps.map((lap) => {
      if (strength) {
        return {
          name: lap.exercise.trim() || "Ejercicio",
          sets: Number(lap.sets) || undefined,
          reps: Number(lap.reps) || undefined,
          weight_kg: Number(lap.weight) || undefined,
          label: lap.label,
        };
      }
      const distanceM = Number(lap.distance) > 0 ? Number(lap.distance) * (swim ? 1 : 1000) : undefined;
      const timeS = Number(lap.duration) > 0 ? Number(lap.duration) * 60 : undefined;
      const pace = parsePace(lap.pace);
      const speedMs = Number(lap.speed) > 0 ? Number(lap.speed) / 3.6 : undefined;
      return {
        label: lap.label,
        intensity: intensity(lap.label),
        distance_m: distanceM,
        time_s: timeS,
        avg_pace_s_per_km: pace,
        avg_speed_ms: speedMs,
        avg_heartrate: Number(lap.hr) || undefined,
        pace_text: lap.pace.trim() || undefined,
        speed_kmh: Number(lap.speed) || undefined,
      };
    });
  }

  function save() {
    setError(null);
    if (!date) return setError("La fecha es obligatoria");
    if (!title.trim()) return setError("El título es obligatorio");
    const durationS = Number(duration) * 60;
    const distanceM = Number(distance) * (swim ? 1 : 1000);
    if (Number(duration) < 0 || Number(distance) < 0 || !Number.isFinite(durationS) || !Number.isFinite(distanceM)) {
      return setError("Duración y distancia deben ser números válidos");
    }
    const payload: Partial<Session> = {
      source: "manual",
      sport,
      title: title.trim(),
      name: title.trim(),
      start_date_local: `${date}T${time || "07:00"}:00`,
      moving_time_s: duration ? durationS : undefined,
      elapsed_time_s: duration ? durationS : undefined,
      distance_m: distance ? distanceM : undefined,
      segments: buildSegments(),
      notes: notes.trim() || undefined,
    };
    if (!strength && durationS > 0 && distanceM > 0) {
      payload.avg_pace_s_per_km = durationS / (distanceM / 1000);
      payload.avg_speed_ms = distanceM / durationS;
    }
    mutation.mutate(payload, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 animate-scale-in" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="mb-5 flex items-center justify-between">
          <div><h3 className="text-lg font-bold">Añadir actividad realizada</h3><p className="text-xs text-gray-500">Sin Garmin ni otra fuente externa</p></div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-gray-400">Título<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Series de carrera" /></label>
          <label className="text-xs text-gray-400">Deporte<select className={field} value={sport} onChange={(e) => { setSport(e.target.value); setLaps([]); }}>
            {SPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="text-xs text-gray-400">Fecha<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs text-gray-400">Hora<input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="text-xs text-gray-400">Duración total (min)<input type="number" min="0" step="0.1" className={field} value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
          {!strength && <label className="text-xs text-gray-400">Distancia total ({distanceUnit})<input type="number" min="0" step="0.01" className={field} value={distance} onChange={(e) => setDistance(e.target.value)} /></label>}
        </div>

        <div className="mt-5 rounded-xl border border-dark-400 p-3">
          <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-semibold">{strength ? "Ejercicios" : "Vueltas / series"}</h4><p className="text-xs text-gray-500">Añade y configura cada parte del entrenamiento.</p></div><button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setLaps((current) => [...current, emptyLap()])}><Plus className="h-3.5 w-3.5" /> Añadir</button></div>
          <div className="space-y-3">
            {laps.map((lap, index) => <div key={index} className="rounded-lg bg-dark-300/40 p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-accent-light">{strength ? `Ejercicio ${index + 1}` : `Vuelta ${index + 1}`}</span><button type="button" className="text-gray-500 hover:text-red-400" onClick={() => setLaps((current) => current.filter((_, i) => i !== index))} aria-label="Eliminar vuelta"><Trash2 className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {strength ? <>
                  <label className="col-span-2 text-[11px] text-gray-400 sm:col-span-2">Ejercicio<input className={field} value={lap.exercise} onChange={(e) => updateLap(index, "exercise", e.target.value)} placeholder="Dominadas" /></label>
                  <label className="text-[11px] text-gray-400">Series<input type="number" min="0" className={field} value={lap.sets} onChange={(e) => updateLap(index, "sets", e.target.value)} /></label>
                  <label className="text-[11px] text-gray-400">Repeticiones<input type="number" min="0" className={field} value={lap.reps} onChange={(e) => updateLap(index, "reps", e.target.value)} /></label>
                  <label className="text-[11px] text-gray-400">Peso (kg)<input type="number" min="0" step="0.1" className={field} value={lap.weight} onChange={(e) => updateLap(index, "weight", e.target.value)} /></label>
                </> : <>
                  <label className="text-[11px] text-gray-400">Tipo<input className={field} list="lap-labels" value={lap.label} onChange={(e) => updateLap(index, "label", e.target.value)} /></label>
                  <label className="text-[11px] text-gray-400">Minutos<input type="number" min="0" step="0.1" className={field} value={lap.duration} onChange={(e) => updateLap(index, "duration", e.target.value)} /></label>
                  <label className="text-[11px] text-gray-400">Distancia ({distanceUnit})<input type="number" min="0" step="0.01" className={field} value={lap.distance} onChange={(e) => updateLap(index, "distance", e.target.value)} /></label>
                  {cycling ? <label className="text-[11px] text-gray-400">Velocidad (km/h)<input className={field} value={lap.speed} onChange={(e) => updateLap(index, "speed", e.target.value)} placeholder="30" /></label> : <label className="text-[11px] text-gray-400">Ritmo<input className={field} value={lap.pace} onChange={(e) => updateLap(index, "pace", e.target.value)} placeholder={swim ? "1:45/100m" : "5:30/km"} /></label>}
                  <label className="text-[11px] text-gray-400">FC (opcional)<input type="number" min="0" className={field} value={lap.hr} onChange={(e) => updateLap(index, "hr", e.target.value)} placeholder="145" /></label>
                </>}
              </div>
            </div>)}
            {laps.length === 0 && <p className="py-4 text-center text-xs text-gray-500">No hay vueltas añadidas. Puedes guardar solo el resumen.</p>}
          </div>
        </div>
        <datalist id="lap-labels">{LABELS.map((label) => <option key={label} value={label} />)}</datalist>
        <label className="mt-4 block text-xs text-gray-400">Notas<AutoTextarea className={field} minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensaciones, recorrido o comentarios..." /></label>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2 border-t border-dark-400 pt-4"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Guardando..." : "Guardar actividad"}</Button></div>
      </form>
    </div>
  );
}
