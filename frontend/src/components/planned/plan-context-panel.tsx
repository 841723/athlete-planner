import { useEffect, useState } from "react";
import { Dumbbell, HeartPulse, Save, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useEquipment } from "@/hooks/use-equipment";
import { useProfile } from "@/hooks/use-profile";
import { useUpdatePlanChatInstructions } from "@/hooks/use-plan-chat";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import type { Plan } from "@/types/session";

function profileValue(profile: Record<string, unknown> | undefined, path: string[]) {
  let value: unknown = profile;
  for (const key of path) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export function PlanContextPanel({ plan }: { plan: Plan }) {
  const { activeTenantId } = useAuth();
  const equipment = useEquipment();
  const profile = useProfile();
  const updateInstructions = useUpdatePlanChatInstructions();
  const [instructions, setInstructions] = useState(plan.chatInstructions ?? "");

  useEffect(() => setInstructions(plan.chatInstructions ?? ""), [plan.chatInstructions]);

  const athlete = profile.data;
  const items = equipment.data?.items ?? [];
  const personal = [
    ["Edad", profileValue(athlete, ["datos_del_atleta", "datos_personales", "edad"])],
    ["Peso", profileValue(athlete, ["datos_del_atleta", "datos_personales", "peso_kg"])],
    ["Altura", profileValue(athlete, ["datos_del_atleta", "datos_personales", "altura_cm"])],
    ["Fatiga", profileValue(athlete, ["datos_del_atleta", "estado_fisico", "fatiga"])],
    ["Carga", profileValue(athlete, ["datos_del_atleta", "estado_fisico", "carga_actual"])],
  ].filter(([, value]) => value);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Dumbbell className="h-4 w-4 text-accent-light" /> Equipamiento</h2>
          <Link className="text-xs text-accent-light hover:text-accent" to={tenantPath(activeTenantId, "/config/equipment")}>Editar</Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.length ? items.map((item) => <span key={`${item.item}-${item.category}`} className="rounded-full bg-dark-300 px-2 py-1 text-[11px] text-gray-300">{item.item}</span>) : <span className="text-xs text-gray-500">Sin equipamiento configurado.</span>}
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="h-4 w-4 text-accent-light" /> Perfil</h2>
          <Link className="text-xs text-accent-light hover:text-accent" to={tenantPath(activeTenantId, "/config/general")}>Editar</Link>
        </div>
        {personal.length ? <div className="space-y-1.5 text-xs">{personal.map(([label, value]) => <div key={label} className="flex justify-between gap-2"><span className="text-gray-500">{label}</span><span className="truncate text-gray-300">{value}</span></div>)}</div> : <span className="text-xs text-gray-500">Sin datos de perfil.</span>}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-accent-light" /> Instrucciones del chat</h2>
        <p className="mb-3 text-[11px] text-gray-500">Preferencias adicionales para este entrenador. El formato y las reglas de seguridad siguen protegidos.</p>
        <textarea className="input min-h-24 w-full resize-y text-xs" maxLength={5000} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Ej.: prioriza sesiones cortas entre semana..." />
        <button className="btn btn-primary mt-2 px-3 py-1.5 text-xs" disabled={updateInstructions.isPending} onClick={() => updateInstructions.mutate({ planId: plan.id, instructions })}>
          <Save className="h-3.5 w-3.5" /> Guardar
        </button>
      </section>
    </aside>
  );
}
