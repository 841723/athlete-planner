import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Session, WorkoutBlock } from "@/types/session";
import { useCreatePlanned, useUpdatePlanned } from "@/hooks/use-planned";
import { Button } from "@/components/ui/button";

interface PlannedFormModalProps {
  open: boolean;
  session?: Session | null;
  defaultDate?: string;
  onClose: () => void;
}

const SPORT_OPTIONS = [
  { value: "running", label: "Carrera" },
  { value: "cycling", label: "Bicicleta" },
  { value: "lap_swimming", label: "Natación" },
  { value: "strength_training", label: "Fuerza" },
  { value: "paddelball", label: "Padel" },
  { value: "hiking", label: "Senderismo" },
  { value: "walking", label: "Caminar" },
  { value: "other", label: "Otros" },
];

const TITLE_OPTIONS = [
  "Carrera en Z2",
  "Carrera en Z3",
  "Series de 400m",
  "5K",
  "10K",
  "Bici llana",
  "Bici en Z2",
  "Natación piscina",
  "Natación aguas abiertas",
  "Fuerza",
  "Padel",
];

function paceToSec(pace: string): number | undefined {
  const m = pace.match(/^(\d+):(\d{2})$/);
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

function secToPace(sec: number | undefined): string {
  if (sec == null) return "";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

interface BlockDraft {
  type: "intervals" | "steady";
  repeat: string;
  distance_m: string;
  time_min: string;
  pace: string;
  rest_min: string;
  hr_from: string;
  hr_to: string;
}

function blockToDraft(b: WorkoutBlock): BlockDraft {
  return {
    type: b.type === "steady" ? "steady" : "intervals",
    repeat: b.repeat ? String(b.repeat) : "",
    distance_m: b.distance_m ? String(b.distance_m) : "",
    time_min: b.time_s ? String(Math.round(b.time_s / 60)) : "",
    pace: secToPace(b.pace_s_per_km),
    rest_min: b.rest_s ? String(Math.round(b.rest_s / 60)) : "",
    hr_from: b.hr_from ? String(b.hr_from) : "",
    hr_to: b.hr_to ? String(b.hr_to) : "",
  };
}

function draftToBlock(d: BlockDraft): WorkoutBlock | null {
  const pace = paceToSec(d.pace);
  if (!d.repeat && !d.distance_m && !d.time_min && !pace && !d.hr_from && !d.hr_to) return null;
  return {
    type: d.type,
    repeat: d.repeat ? Number(d.repeat) : undefined,
    distance_m: d.distance_m ? Number(d.distance_m) : undefined,
    time_s: d.time_min ? Number(d.time_min) * 60 : undefined,
    pace_s_per_km: pace,
    rest_s: d.rest_min ? Number(d.rest_min) * 60 : undefined,
    hr_from: d.hr_from ? Number(d.hr_from) : undefined,
    hr_to: d.hr_to ? Number(d.hr_to) : undefined,
  };
}

export function PlannedFormModal({ open, session, defaultDate, onClose }: PlannedFormModalProps) {
  const createMutation = useCreatePlanned();
  const updateMutation = useUpdatePlanned();

  const [sport, setSport] = useState("running");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [distanceKm, setDistanceKm] = useState("");
  const [pace, setPace] = useState("");
  const [timeMin, setTimeMin] = useState("");
  const [hrFrom, setHrFrom] = useState("");
  const [hrTo, setHrTo] = useState("");
  const [warmupMin, setWarmupMin] = useState("");
  const [cooldownMin, setCooldownMin] = useState("");
  const [blocks, setBlocks] = useState<BlockDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const s = session;
    setSport(s?.sport ?? "running");
    setTitle(s?.title ?? "");
    setName(s?.name ?? "");
    setDate((s?.start_date_local ?? defaultDate ?? "").slice(0, 10));
    setTime((s?.start_date_local ?? `${defaultDate ?? ""}T07:00:00`).slice(11, 16) || "07:00");
    setDistanceKm(s?.distance_m ? String(s.distance_m / 1000) : "");
    setPace(secToPace(s?.avg_pace_s_per_km));
    setTimeMin(s?.moving_time_s ? String(Math.round(s.moving_time_s / 60)) : "");
    setHrFrom(s?.hr_from ? String(s.hr_from) : "");
    setHrTo(s?.hr_to ? String(s.hr_to) : "");
    setWarmupMin(s?.workout?.warmup_s ? String(Math.round(s.workout.warmup_s / 60)) : "");
    setCooldownMin(s?.workout?.cooldown_s ? String(Math.round(s.workout.cooldown_s / 60)) : "");
    setBlocks((s?.workout?.blocks ?? []).map(blockToDraft));
    setError(null);
  }, [open, session, defaultDate]);

  if (!open) return null;

  const saving = createMutation.isPending || updateMutation.isPending;

  function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!date) {
      setError("La fecha es obligatoria");
      return;
    }

    const parsedBlocks = blocks
      .map(draftToBlock)
      .filter((b): b is WorkoutBlock => b != null);
    const hasWorkout = parsedBlocks.length > 0 || warmupMin || cooldownMin;

    const payload = {
      sport,
      title: title.trim(),
      name: name.trim() || title.trim(),
      start_date_local: `${date}T${time || "07:00"}:00`,
      distance_m: distanceKm ? Math.round(Number(distanceKm) * 1000) : undefined,
      avg_pace_s_per_km: paceToSec(pace),
      moving_time_s: timeMin ? Number(timeMin) * 60 : undefined,
      elapsed_time_s: timeMin ? Number(timeMin) * 60 : undefined,
      hr_from: hrFrom ? Number(hrFrom) : undefined,
      hr_to: hrTo ? Number(hrTo) : undefined,
      workout: hasWorkout
        ? {
            warmup_s: warmupMin ? Number(warmupMin) * 60 : undefined,
            cooldown_s: cooldownMin ? Number(cooldownMin) * 60 : undefined,
            blocks: parsedBlocks,
          }
        : undefined,
    };

    if (session) {
      updateMutation.mutate(
        { id: session.id, payload },
        { onSuccess: () => onClose() }
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => onClose() });
    }
  }

  const field = "w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">
            {session ? "Editar planificada" : "Nueva planificada"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-gray-400 col-span-2">
            Título
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carrera en Z2" list="planned-titles" />
            <datalist id="planned-titles">
              {TITLE_OPTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </label>
          <label className="text-xs text-gray-400 col-span-2">
            Nombre
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="text-xs text-gray-400">
            Deporte
            <select className={field} value={sport} onChange={(e) => setSport(e.target.value)}>
              {SPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">
            Fecha
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-xs text-gray-400">
            Hora
            <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="text-xs text-gray-400">
            Distancia (km)
            <input type="number" min="0" step="0.01" className={field} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="10" />
          </label>
          <label className="text-xs text-gray-400">
            Ritmo (mm:ss /km)
            <input className={field} value={pace} onChange={(e) => setPace(e.target.value)} placeholder="5:30" />
          </label>
          <label className="text-xs text-gray-400">
            Duración (min)
            <input type="number" min="0" className={field} value={timeMin} onChange={(e) => setTimeMin(e.target.value)} placeholder="60" />
          </label>
          <label className="text-xs text-gray-400">
            FC objetivo desde
            <input type="number" className={field} value={hrFrom} onChange={(e) => setHrFrom(e.target.value)} placeholder="130" />
          </label>
          <label className="text-xs text-gray-400">
            FC objetivo hasta
            <input type="number" className={field} value={hrTo} onChange={(e) => setHrTo(e.target.value)} placeholder="138" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-gray-400">
            Calentamiento (min)
            <input type="number" min="0" className={field} value={warmupMin} onChange={(e) => setWarmupMin(e.target.value)} placeholder="10" />
          </label>
          <label className="text-xs text-gray-400">
            Enfriamiento (min)
            <input type="number" min="0" className={field} value={cooldownMin} onChange={(e) => setCooldownMin(e.target.value)} placeholder="10" />
          </label>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Bloques</span>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() =>
                setBlocks((prev) => [
                  ...prev,
                  { type: "intervals", repeat: "", distance_m: "", time_min: "", pace: "", rest_min: "", hr_from: "", hr_to: "" },
                ])
              }
            >
              <Plus className="w-3 h-3" /> Añadir
            </Button>
          </div>
          {blocks.length === 0 && (
            <p className="text-xs text-gray-600">Sin bloques estructurados.</p>
          )}
          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div key={i} className="grid grid-cols-3 sm:grid-cols-9 gap-2 items-end p-2.5 rounded-lg bg-dark-300/50">
                <label className="text-[10px] text-gray-400">
                  Tipo
                  <select
                    className={field}
                    value={block.type}
                    onChange={(e) =>
                      setBlocks((prev) =>
                        prev.map((b, j) => (j === i ? { ...b, type: e.target.value as "intervals" | "steady" } : b))
                      )
                    }
                  >
                    <option value="intervals">Series</option>
                    <option value="steady">Fondo</option>
                  </select>
                </label>
                <label className="text-[10px] text-gray-400">
                  Reps
                  <input className={field} value={block.repeat} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, repeat: e.target.value } : b)))} placeholder="4" />
                </label>
                <label className="text-[10px] text-gray-400">
                  Distancia (m)
                  <input className={field} value={block.distance_m} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, distance_m: e.target.value } : b)))} placeholder="400" />
                </label>
                <label className="text-[10px] text-gray-400">
                  Tiempo (min)
                  <input className={field} value={block.time_min} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, time_min: e.target.value } : b)))} placeholder="20" />
                </label>
                <label className="text-[10px] text-gray-400">
                  Ritmo
                  <input className={field} value={block.pace} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, pace: e.target.value } : b)))} placeholder="3:45" />
                </label>
                <label className="text-[10px] text-gray-400">
                  Descanso (min)
                  <input className={field} value={block.rest_min} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, rest_min: e.target.value } : b)))} placeholder="2" />
                </label>
                <label className="text-[10px] text-gray-400">
                  FC desde
                  <input className={field} value={block.hr_from} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, hr_from: e.target.value } : b)))} placeholder="130" />
                </label>
                <label className="text-[10px] text-gray-400">
                  FC hasta
                  <input className={field} value={block.hr_to} onChange={(e) => setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, hr_to: e.target.value } : b)))} placeholder="138" />
                </label>
                <button
                  className="text-gray-500 hover:text-red-400 p-1.5"
                  onClick={() => setBlocks((prev) => prev.filter((_, j) => j !== i))}
                  title="Eliminar bloque"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end pt-4 border-t border-dark-400">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : session ? "Guardar cambios" : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
