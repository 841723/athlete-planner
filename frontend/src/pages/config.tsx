import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  Trash,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useGoals, useUpdateGoals } from "@/hooks/use-goals";
import { updateTenantName } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TenantRole } from "@/types/auth";
import type { RaceGoal } from "@/types/session";

const ROLE_LABELS: Record<TenantRole, string> = {
  athlete: "Atleta",
  admin: "Administrador",
  visitor: "Visitante",
};

function emptyGoal(): RaceGoal {
  return { week: 0, label: "", date: "", targetPace: "" };
}

export function ConfigPage() {
  const { tenants, activeTenantId, refresh } = useAuth();
  const perms = usePermissions();
  const { toast } = useToast();
  const { data: members, isLoading: membersLoading } = useMembers(activeTenantId);
  const addMutation = useAddMember(activeTenantId);
  const updateRoleMutation = useUpdateMemberRole(activeTenantId);
  const removeMutation = useRemoveMember(activeTenantId);

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

  const profileQuery = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const [profileText, setProfileText] = useState("{}");
  useEffect(() => {
    if (profileQuery.data) setProfileText(JSON.stringify(profileQuery.data, null, 2));
  }, [profileQuery.data]);

  const goalsQuery = useGoals();
  const updateGoalsMutation = useUpdateGoals();
  const [goals, setGoals] = useState<RaceGoal[]>([]);
  useEffect(() => {
    if (goalsQuery.data) setGoals(goalsQuery.data);
  }, [goalsQuery.data]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("visitor");

  if (!perms.canManageUsers) {
    return (
      <div className="animate-fade-in">
        <div className="card p-10 text-center">
          <p className="text-gray-500">No tienes permisos para acceder a la configuración.</p>
        </div>
      </div>
    );
  }

  function handleAddMember() {
    addMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => setEmail(""),
        onError: (e) => window.alert(e.message),
      }
    );
  }

  function handleSaveProfile() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(profileText);
    } catch {
      toast({ type: "error", title: "JSON no válido", description: "Revisa la sintaxis del perfil." });
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      toast({ type: "error", title: "JSON no válido", description: "El perfil debe ser un objeto." });
      return;
    }
    updateProfileMutation.mutate(parsed as Record<string, unknown>);
  }

  function patchGoal(index: number, patch: Partial<RaceGoal>) {
    setGoals((g) => g.map((goal, i) => (i === index ? { ...goal, ...patch } : goal)));
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Nombre del atleta, perfil, objetivos y permisos del tenant.
        </p>
      </div>

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
          <UserPlus className="w-4 h-4" /> Perfil del atleta (JSON)
        </h2>
        {profileQuery.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <>
            <textarea
              className="input w-full font-mono text-xs h-40 resize-y"
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">Datos usados por el planificador y los objetivos.</span>
              <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" /> Próximos objetivos
        </h2>
        {goalsQuery.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <div className="space-y-2">
            {goals.map((g, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[5rem_1fr_9rem_7rem_auto] gap-2 items-center">
                <input
                  type="number"
                  className="input py-1.5 text-sm"
                  placeholder="Semana"
                  value={g.week}
                  onChange={(e) => patchGoal(i, { week: Number(e.target.value) })}
                />
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Etiqueta (ej. Athlete Planner)"
                  value={g.label}
                  onChange={(e) => patchGoal(i, { label: e.target.value })}
                />
                <input
                  type="date"
                  className="input py-1.5 text-sm"
                  value={g.date ?? ""}
                  onChange={(e) => patchGoal(i, { date: e.target.value })}
                />
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Ritmo objetivo"
                  value={g.targetPace ?? ""}
                  onChange={(e) => patchGoal(i, { targetPace: e.target.value })}
                />
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                  onClick={() => setGoals((gs) => gs.filter((_, j) => j !== i))}
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" className="text-xs" onClick={() => setGoals((gs) => [...gs, emptyGoal()])}>
                <Plus className="w-3.5 h-3.5" /> Añadir objetivo
              </Button>
              <Button onClick={() => updateGoalsMutation.mutate(goals)} disabled={updateGoalsMutation.isPending}>
                {updateGoalsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Permisos
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="select sm:w-44"
            value={role}
            onChange={(e) => setRole(e.target.value as TenantRole)}
          >
            <option value="visitor">Visitante</option>
            <option value="admin">Administrador</option>
          </select>
          <Button onClick={handleAddMember} disabled={addMutation.isPending || !email.trim()}>
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Añadir
          </Button>
        </div>
        {addMutation.isError && (
          <p className="text-sm text-red-400 mt-2">{addMutation.error.message}</p>
        )}
        {membersLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-2">
            {members?.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-dark-300/50">
                {m.picture ? (
                  <img src={m.picture} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                    {(m.name ?? m.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name ?? m.email}
                    {m.isOwner && <span className="text-accent-light ml-2 text-xs">Owner</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                </div>
                {m.isOwner ? (
                  <span className="text-xs text-gray-400 uppercase">{ROLE_LABELS[m.role]}</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      className="select w-36 py-1.5 text-xs"
                      value={m.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          userId: m.id,
                          role: e.target.value as TenantRole,
                        })
                      }
                    >
                      <option value="admin">Administrador</option>
                      <option value="visitor">Visitante</option>
                    </select>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar a ${m.name ?? m.email}?`)) {
                          removeMutation.mutate(m.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          El atleta propietario (rol Atleta) tiene permisos totales y no puede ser eliminado por otros usuarios.
        </p>
      </div>
    </div>
  );
}
