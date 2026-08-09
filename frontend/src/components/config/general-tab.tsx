import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, CalendarRange, Dumbbell, Loader2, Save } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useMeta, useUpdateMeta } from "@/hooks/use-meta";
import { updateTenantName } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/config/profile-form";
import type { FocusSport } from "@/types/session";

const FOCUS_OPTIONS: { id: FocusSport; label: string; emoji: string }[] = [
  { id: "running", label: "Running", emoji: "🏃" },
  { id: "cycling", label: "Ciclismo", emoji: "🚴" },
  { id: "swimming", label: "Natación", emoji: "🏊" },
];

export function GeneralTab() {
  const { tenants, activeTenantId, refresh } = useAuth();
  const perms = usePermissions();
  const { toast } = useToast();
  const updateMetaMutation = useUpdateMeta();

  const activeTenant = tenants.find((t) => t.id === activeTenantId);

  const [tenantName, setTenantName] = useState(activeTenant?.name ?? "");
  useEffect(() => {
    setTenantName(activeTenant?.name ?? "");
  }, [activeTenant?.name]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateTenantName(name),
    onSuccess: async () => {
      await refresh();
      toast({ type: "success", title: "Nombre del atleta actualizado" });
    },
    onError: (err: Error) => {
      toast({ type: "error", title: "Error al renombrar", description: err.message });
    },
  });

  const { data: meta, isLoading: metaLoading } = useMeta();
  const [planStart, setPlanStart] = useState("");
  const [focusSports, setFocusSports] = useState<FocusSport[]>(["running", "cycling", "swimming"]);

  useEffect(() => {
    if (!meta) return;
    setPlanStart(meta.planStart ?? "");
    setFocusSports((meta.focusSports as FocusSport[]) ?? ["running", "cycling", "swimming"]);
  }, [meta]);

  function toggleSport(sport: FocusSport) {
    setFocusSports((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport]
    );
  }

  function handleSavePlan() {
    if (focusSports.length === 0) {
      toast({ type: "error", title: "Selecciona al menos un deporte de enfoque" });
      return;
    }
    updateMetaMutation.mutate(
      {
        plan_start: planStart || null,
        focus_sports: focusSports,
      },
      {
        onSuccess: () => toast({ type: "success", title: "Plan guardado" }),
        onError: (err: Error) => toast({ type: "error", title: "Error al guardar", description: err.message }),
      }
    );
  }

  return (
    <>
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Nombre del atleta
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
          />
          <Button
            onClick={() => renameMutation.mutate(tenantName)}
            disabled={renameMutation.isPending || !tenantName.trim() || tenantName.trim() === activeTenant?.name}
          >
            {renameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarRange className="w-4 h-4" /> Plan
        </h2>
        {metaLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fecha de inicio del plan</label>
              <input
                type="date"
                className="input"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
                disabled={!perms.canManageUsers}
              />
              <p className="text-xs text-gray-500 mt-1">
                La semana de entrenamiento actual se calcula desde esta fecha; las semanas comienzan en lunes.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2 flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" /> Deportes de enfoque
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Los deportes que el atleta quiere mejorar. La IA centrará el plan en ellos y el perfil mostrará
                campos para cada uno. Puede practicar otros deportes, pero estos son la prioridad.
              </p>
              <div className="flex flex-wrap gap-2">
                {FOCUS_OPTIONS.map((opt) => {
                  const active = focusSports.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleSport(opt.id)}
                      disabled={!perms.canManageUsers}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                        active
                          ? "border-accent/50 bg-accent/15 text-accent-light"
                          : "border-dark-400 bg-dark-300/40 text-gray-400 hover:border-dark-400"
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleSavePlan} disabled={updateMetaMutation.isPending || !perms.canManageUsers}>
              {updateMetaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar plan
            </Button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Perfil del atleta
        </h2>
        <ProfileForm canManage={perms.canManageUsers} />
      </div>
    </>
  );
}
