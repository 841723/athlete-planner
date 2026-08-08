import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Session } from "@/types/session";
import { useCreatePlanned, useUpdatePlanned } from "@/hooks/use-planned";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";

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

const PLACEHOLDERS: Record<string, string> = {
  running: `65 min @ Z2

o con series:
calentamiento libre
12x
    400m @ 3:30 min/km
    1 min descanso
enfriamiento libre`,
  cycling: `10 min @90W
3x
    15 min @130-135W
    5 min @90W
10 min suaves

o simplemente: MTB`,
  lap_swimming: `300 suaves
4x28m Side Kick
4x56m Catch-Up
7x112m continuos suaves
4x28m bilateral
200 suaves`,
  strength_training: `Ejercicios principales con series y repeticiones.

Ej:
Sentadillas 3x10
Press banca 3x8
...`,
};

export function PlannedFormModal({ open, session, defaultDate, onClose }: PlannedFormModalProps) {
  const createMutation = useCreatePlanned();
  const updateMutation = useUpdatePlanned();

  const [sport, setSport] = useState("running");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [workoutText, setWorkoutText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const s = session;
    setSport(s?.sport ?? "running");
    setTitle(s?.title ?? "");
    setDate((s?.start_date_local ?? defaultDate ?? "").slice(0, 10));
    setTime((s?.start_date_local ?? `${defaultDate ?? ""}T07:00:00`).slice(11, 16) || "07:00");
    setWorkoutText(s?.workout_text ?? "");
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

    const payload = {
      sport,
      title: title.trim(),
      name: title.trim(),
      start_date_local: `${date}T${time || "07:00"}:00`,
      workout_text: workoutText.trim() || undefined,
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
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-xs text-gray-400 col-span-2">
            Título
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carrera en Z2" list="planned-titles" />
            <datalist id="planned-titles">
              {TITLE_OPTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
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
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-1.5">
            Vueltas / Trabajo
          </label>
          <AutoTextarea
            className={`${field} font-mono text-[13px] leading-relaxed`}
            minRows={12}
            value={workoutText}
            onChange={(e) => setWorkoutText(e.target.value)}
            placeholder={PLACEHOLDERS[sport] ?? "Describe el trabajo a realizar..."}
          />
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
