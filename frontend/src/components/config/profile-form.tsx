import { useEffect, useState } from "react";
import { CheckCircle, History, Loader2, Save } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useProfileHistory, useSetActiveProfileVersion } from "@/hooks/use-profile-history";
import { fetchProfileVersion } from "@/services/trainer";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { ProfileVersion } from "@/types/session";
import { computeProfileDiff, type ProfileDiff } from "@/lib/profile-diff";

type Profile = Record<string, any>;

function str(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join("\n");
  return String(value);
}

type DisciplineState = {
  nivel: string;
  fc_z2: string;
  ritmo: string;
  potencia_w: string;
  ritmo_100m: string;
  observaciones: string;
};

const EMPTY_DISCIPLINE: DisciplineState = {
  nivel: "",
  fc_z2: "",
  ritmo: "",
  potencia_w: "",
  ritmo_100m: "",
  observaciones: "",
};

type FormState = {
  genero: string;
  edad: string;
  peso_kg: string;
  altura_cm: string;
  disponibilidad: string;
  running: DisciplineState;
  cycling: DisciplineState;
  swimming: DisciplineState;
  fuerza: DisciplineState;
  estado_fisico: { carga_actual: string; fatiga: string; lesiones: string };
};

const EMPTY_FORM: FormState = {
  genero: "",
  edad: "",
  peso_kg: "",
  altura_cm: "",
  disponibilidad: "",
  running: { ...EMPTY_DISCIPLINE },
  cycling: { ...EMPTY_DISCIPLINE },
  swimming: { ...EMPTY_DISCIPLINE },
  fuerza: { ...EMPTY_DISCIPLINE },
  estado_fisico: { carga_actual: "", fatiga: "", lesiones: "" },
};

export function ProfileForm({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const profileQuery = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const profileHistoryQuery = useProfileHistory();
  const setActiveVersionMutation = useSetActiveProfileVersion();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const p = profileQuery.data as Profile | undefined;

  useEffect(() => {
    if (!p) return;
    const d = p.datos_del_atleta;
    const dp = d?.datos_personales ?? {};
    const ea = d?.estado_actual ?? {};
    const ef = d?.estado_fisico ?? {};
    const dis = (key: string, src: any) => str(src?.[key] ?? "");

    setForm({
      genero: str(dp.genero ?? p.personal?.gender),
      edad: str(dp.edad ?? p.personal?.age),
      peso_kg: str(dp.peso_kg ?? p.personal?.weight_kg),
      altura_cm: str(dp.altura_cm ?? (p.personal?.height_m ? Math.round(p.personal.height_m * 100) : "")),
      disponibilidad: str(d?.disponibilidad_horaria ?? p.schedule?.work),
      running: {
        nivel: dis("nivel", ea.running),
        fc_z2: dis("fc_z2", ea.running),
        ritmo: dis("ritmo", ea.running),
        potencia_w: "",
        ritmo_100m: "",
        observaciones: dis("observaciones", ea.running),
      },
      cycling: {
        nivel: dis("nivel", ea.cycling),
        fc_z2: "",
        ritmo: "",
        potencia_w: dis("potencia_w", ea.cycling),
        ritmo_100m: "",
        observaciones: dis("observaciones", ea.cycling),
      },
      swimming: {
        nivel: dis("nivel", ea.swimming),
        fc_z2: "",
        ritmo: "",
        potencia_w: "",
        ritmo_100m: dis("ritmo_100m", ea.swimming),
        observaciones: dis("observaciones", ea.swimming),
      },
      fuerza: {
        nivel: dis("nivel", ea.fuerza),
        fc_z2: "",
        ritmo: "",
        potencia_w: "",
        ritmo_100m: "",
        observaciones: dis("observaciones", ea.fuerza),
      },
      estado_fisico: {
        carga_actual: dis("carga_actual", ef),
        fatiga: dis("fatiga", ef),
        lesiones: dis("lesiones", ef),
      },
    });
  }, [p]);

  const [restoreCandidate, setRestoreCandidate] = useState<{
    version: ProfileVersion;
    diff: ProfileDiff;
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  async function handleRestoreVersion(version: ProfileVersion) {
    if (!p) {
      setActiveVersionMutation.mutate(version.id);
      return;
    }
    setDiffLoading(true);
    try {
      const target = await fetchProfileVersion(version.id);
      setRestoreCandidate({
        version,
        diff: computeProfileDiff(p, target.data),
      });
    } catch {
      toast({ type: "error", title: "Error al cargar versiones" });
    } finally {
      setDiffLoading(false);
    }
  }

  function setDiscipline(key: keyof Pick<FormState, "running" | "cycling" | "swimming" | "fuerza">, field: keyof DisciplineState, value: string) {
    setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }));
  }

  function handleSaveForm() {
    if (!p) return;
    const merged: Profile = JSON.parse(JSON.stringify(p));
    const d = (merged.datos_del_atleta ??= {});
    d.datos_personales = {
      ...(d.datos_personales ?? {}),
      genero: form.genero.trim() || "",
      edad: form.edad ? Number(form.edad) : null,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
      altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
    };
    d.disponibilidad_horaria = form.disponibilidad.trim() || "";
    d.estado_actual = {
      running: pickDiscipline(form.running, ["nivel", "fc_z2", "ritmo", "observaciones"]),
      cycling: pickDiscipline(form.cycling, ["nivel", "potencia_w", "observaciones"]),
      swimming: pickDiscipline(form.swimming, ["nivel", "ritmo_100m", "observaciones"]),
      fuerza: pickDiscipline(form.fuerza, ["nivel", "observaciones"]),
    };
    d.estado_fisico = {
      ...(d.estado_fisico ?? {}),
      carga_actual: form.estado_fisico.carga_actual.trim() || "",
      fatiga: form.estado_fisico.fatiga.trim() || "",
      lesiones: form.estado_fisico.lesiones.trim() || "",
    };
    updateProfileMutation.mutate(merged);
  }

  if (profileQuery.isLoading) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const inputCls =
    "w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60";

  const field = (label: string, value: string, onChange: (v: string) => void, props: Record<string, unknown> = {}) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!canManage}
        {...props}
      />
    </div>
  );

  const textarea = (label: string, value: string, onChange: (v: string) => void, props: Record<string, unknown> = {}) => (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <AutoTextarea
        className={inputCls}
        minRows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!canManage}
        {...props}
      />
    </div>
  );

  const sectionTitle = (title: string, subtitle?: string) => (
    <div>
      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
      {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
    </div>
  );

  const disciplineBlock = (
    key: "running" | "cycling" | "swimming" | "fuerza",
    label: string,
    fields: { label: string; field: keyof DisciplineState; full?: boolean; placeholder?: string }[]
  ) => (
    <div className="rounded-xl bg-dark-300/30 border border-dark-400 p-3 space-y-3">
      <div className="text-xs font-semibold text-accent">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) =>
          f.field === "observaciones" ? (
            <div key={f.field} className={f.full ? "sm:col-span-2" : ""}>
              {textarea(f.label, form[key][f.field], (v) => setDiscipline(key, f.field, v))}
            </div>
          ) : (
            <div key={f.field}>
              {field(f.label, form[key][f.field], (v) => setDiscipline(key, f.field, v), f.placeholder ? { placeholder: f.placeholder } : {})}
            </div>
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{profileHistoryQuery.data?.length ?? 0} versiones guardadas</span>
      </div>

      <div className="space-y-4">
        <div>
          {sectionTitle("Datos personales")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {field("Género", form.genero, (v) => setForm((f) => ({ ...f, genero: v })), { placeholder: "Masculino / Femenino" })}
            {field("Edad", form.edad, (v) => setForm((f) => ({ ...f, edad: v })), { type: "number" })}
            {field("Peso (kg)", form.peso_kg, (v) => setForm((f) => ({ ...f, peso_kg: v })), { type: "number", step: "0.1" })}
            {field("Altura (cm)", form.altura_cm, (v) => setForm((f) => ({ ...f, altura_cm: v })), { type: "number" })}
          </div>
        </div>

        <div>
          {sectionTitle("Disponibilidad")}
          <div className="mt-2">{textarea("Disponibilidad horaria", form.disponibilidad, (v) => setForm((f) => ({ ...f, disponibilidad: v })))}</div>
        </div>

        <div>
          {sectionTitle("Estado actual por disciplina", "Ritmos, potencia y FC en Z2 (ritmo aeróbico de fondo, no el ritmo máximo que puedas mantener en distancias cortas)")}
          <div className="space-y-3 mt-2">
            {disciplineBlock("running", "Running", [
              { label: "Nivel", field: "nivel" },
              { label: "FC en Z2", field: "fc_z2" },
              { label: "Ritmo en Z2 (min/km)", field: "ritmo", placeholder: "Ej. 6:15-6:35/km" },
              { label: "Observaciones", field: "observaciones", full: true },
            ])}
            {disciplineBlock("cycling", "Ciclismo", [
              { label: "Nivel", field: "nivel" },
              { label: "Potencia en Z2 (W)", field: "potencia_w", placeholder: "Ej. 130-135 W" },
              { label: "Observaciones", field: "observaciones", full: true },
            ])}
            {disciplineBlock("swimming", "Natación", [
              { label: "Nivel", field: "nivel" },
              { label: "Ritmo en Z2 (/100m)", field: "ritmo_100m", placeholder: "Ej. 2:25-2:35 /100m" },
              { label: "Observaciones", field: "observaciones", full: true },
            ])}
            {disciplineBlock("fuerza", "Fuerza", [
              { label: "Nivel", field: "nivel" },
              { label: "Observaciones", field: "observaciones", full: true },
            ])}
          </div>
        </div>

        <div>
          {sectionTitle("Estado físico general")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {field("Carga actual", form.estado_fisico.carga_actual, (v) => setForm((f) => ({ ...f, estado_fisico: { ...f.estado_fisico, carga_actual: v } })))}
            {field("Fatiga", form.estado_fisico.fatiga, (v) => setForm((f) => ({ ...f, estado_fisico: { ...f.estado_fisico, fatiga: v } })))}
            {field("Lesiones", form.estado_fisico.lesiones, (v) => setForm((f) => ({ ...f, estado_fisico: { ...f.estado_fisico, lesiones: v } })))}
          </div>
        </div>

        <div className="flex justify-end">
          {canManage && (
            <Button onClick={handleSaveForm} disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar perfil
            </Button>
          )}
        </div>
      </div>

      {profileHistoryQuery.data && profileHistoryQuery.data.length > 0 && (
        <div className="border-t border-dark-400 pt-4">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Historial de versiones
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {profileHistoryQuery.data.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-2 rounded-lg bg-dark-300/30 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      v.author === "ai" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {v.author === "ai" ? "IA" : "Manual"}
                  </span>
                  <span className="text-gray-400">{new Date(v.created_at).toLocaleString("es-ES")}</span>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-0.5"
                    onClick={() => handleRestoreVersion(v)}
                    disabled={setActiveVersionMutation.isPending || diffLoading}
                  >
                    {diffLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Recuperar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {restoreCandidate && (
        <div className="border-t border-dark-400 pt-4">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
            ¿Recuperar esta versión?
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Comparación del perfil actual con la versión del{" "}
            {new Date(restoreCandidate.version.created_at).toLocaleString("es-ES")}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-gray-500 mb-1">Perfil actual</div>
              <div className="text-[10px] text-gray-300 bg-dark-300/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono leading-4">
                {restoreCandidate.diff.left.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.kind === "removed"
                        ? "bg-red-500/20 text-red-300"
                        : l.kind === "added"
                          ? "bg-green-500/20 text-green-300"
                          : ""
                    }
                  >
                    {l.text}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">Versión a recuperar</div>
              <div className="text-[10px] text-gray-300 bg-dark-300/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono leading-4">
                {restoreCandidate.diff.right.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.kind === "removed"
                        ? "bg-red-500/20 text-red-300"
                        : l.kind === "added"
                          ? "bg-green-500/20 text-green-300"
                          : ""
                    }
                  >
                    {l.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" className="text-xs" onClick={() => setRestoreCandidate(null)}>
              Cancelar
            </Button>
            <Button
              className="text-xs"
              onClick={() => {
                setActiveVersionMutation.mutate(restoreCandidate.version.id);
                setRestoreCandidate(null);
              }}
              disabled={setActiveVersionMutation.isPending}
            >
              {setActiveVersionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Recuperar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pickDiscipline(d: DisciplineState, keys: (keyof DisciplineState)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = String(d[k] ?? "").trim();
    if (v) out[k] = v;
  }
  return out;
}
