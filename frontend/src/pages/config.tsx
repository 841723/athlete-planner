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
  Brain,
  History,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useGoals, useUpdateGoals } from "@/hooks/use-goals";
import { useAiSettings, useUpdateAiSettings, useTestAiSettings } from "@/hooks/use-ai-settings";
import { useProfileHistory, useSetActiveProfileVersion, useProfileVersion } from "@/hooks/use-profile-history";
import { updateTenantName, fetchProfileVersion } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TenantRole } from "@/types/auth";
import type { RaceGoal, ProfileVersion } from "@/types/session";
import { lineDiff, type DiffLine } from "@/lib/diff";

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

  const aiSettingsQuery = useAiSettings();
  const updateAiMutation = useUpdateAiSettings();
  const testAiMutation = useTestAiSettings();
  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  useEffect(() => {
    if (aiSettingsQuery.data?.provider) setAiProvider(aiSettingsQuery.data.provider);
    if (aiSettingsQuery.data?.model) setAiModel(aiSettingsQuery.data.model);
  }, [aiSettingsQuery.data]);

  const profileHistoryQuery = useProfileHistory();
  const setActiveVersionMutation = useSetActiveProfileVersion();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<{ left: DiffLine[]; right: DiffLine[] } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  async function handleCompareDiff() {
    if (!selectedVersionId || !compareVersionId) return;
    setDiffLoading(true);
    try {
      const [left, right] = await Promise.all([
        fetchProfileVersion(selectedVersionId),
        fetchProfileVersion(compareVersionId),
      ]);
      const leftJson = JSON.stringify(left.data, null, 2);
      const rightJson = JSON.stringify(right.data, null, 2);
      setDiffResult({
        left: lineDiff(rightJson, leftJson),
        right: lineDiff(leftJson, rightJson),
      });
    } catch {
      toast({ type: "error", title: "Error al cargar versiones" });
    } finally {
      setDiffLoading(false);
    }
  }

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

  function handleSaveAiSettings() {
    if (!aiApiKey.trim()) {
      toast({ type: "error", title: "Introduce tu API key" });
      return;
    }
    updateAiMutation.mutate({
      provider: aiProvider,
      apiKey: aiApiKey,
      model: aiModel,
    });
  }

  function handleTestAi() {
    testAiMutation.mutate(undefined, {
      onSuccess: () => toast({ type: "success", title: "Conexión correcta" }),
      onError: (err: Error) => toast({ type: "error", title: "Error de conexión", description: err.message }),
    });
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Nombre del atleta, perfil, objetivos, IA y permisos del tenant.
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
          <Brain className="w-4 h-4" /> Proveedor de IA
        </h2>
        {perms.role === "athlete" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Proveedor</label>
                <select
                  className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                >
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Modelo</label>
                <select
                  className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                >
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">API Key</label>
              <input
                type="password"
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={aiSettingsQuery.data ? "•••••••• (guardada)" : "Introduce tu API key de Gemini"}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveAiSettings} disabled={updateAiMutation.isPending}>
                {updateAiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
              <Button
                variant="ghost"
                onClick={handleTestAi}
                disabled={testAiMutation.isPending || !aiSettingsQuery.data}
              >
                {testAiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Probar conexión
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Tu API key se almacena de forma segura y solo se usa para generar planes de entrenamiento.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Solo el atleta (rol Atleta) puede configurar el proveedor de IA.
          </p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Perfil del atleta
        </h2>
        {profileQuery.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Versión activa del perfil</span>
                <span className="text-xs text-gray-500">
                  {profileHistoryQuery.data?.length ?? 0} versiones guardadas
                </span>
              </div>
              <textarea
                className="input w-full font-mono text-xs h-40 resize-y"
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                spellCheck={false}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">Edita manualmente y guarda como nueva versión.</span>
                <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </Button>
              </div>
            </div>

            {profileHistoryQuery.data && profileHistoryQuery.data.length > 0 && (
              <div className="border-t border-dark-400 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4" /> Historial de versiones
                  </h3>
                  <div className="flex gap-2">
                    <select
                      className="select text-xs py-1"
                      value={selectedVersionId ?? ""}
                      onChange={(e) => setSelectedVersionId(e.target.value || null)}
                    >
                      <option value="">Seleccionar versión...</option>
                      {profileHistoryQuery.data.map((v) => (
                        <option key={v.id} value={v.id}>
                          {new Date(v.created_at).toLocaleString("es-ES")} - {v.author === "ai" ? "IA" : "Manual"}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select text-xs py-1"
                      value={compareVersionId ?? ""}
                      onChange={(e) => setCompareVersionId(e.target.value || null)}
                    >
                      <option value="">Comparar con...</option>
                      {profileHistoryQuery.data.map((v) => (
                        <option key={v.id} value={v.id}>
                          {new Date(v.created_at).toLocaleString("es-ES")} - {v.author === "ai" ? "IA" : "Manual"}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={handleCompareDiff}
                      disabled={!selectedVersionId || !compareVersionId || diffLoading}
                    >
                      {diffLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      Ver diff
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {profileHistoryQuery.data.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-dark-300/30 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          v.author === "ai" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                        }`}>
                          {v.author === "ai" ? "IA" : "Manual"}
                        </span>
                        <span className="text-gray-400">
                          {new Date(v.created_at).toLocaleString("es-ES")}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        className="text-xs px-2 py-0.5"
                        onClick={() => setActiveVersionMutation.mutate(v.id)}
                        disabled={setActiveVersionMutation.isPending}
                      >
                        Usar esta versión
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diffResult && (
              <div className="border-t border-dark-400 pt-4">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Comparación</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">Versión A</div>
                    <div className="text-[10px] text-gray-300 bg-dark-300/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono leading-4">
                      {diffResult.left.map((l, i) => (
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
                    <div className="text-[10px] text-gray-500 mb-1">Versión B</div>
                    <div className="text-[10px] text-gray-300 bg-dark-300/50 rounded-lg p-3 max-h-64 overflow-y-auto font-mono leading-4">
                      {diffResult.right.map((l, i) => (
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
                <Button
                  variant="ghost"
                  className="text-xs mt-2"
                  onClick={() => setDiffResult(null)}
                >
                  Cerrar diff
                </Button>
              </div>
            )}
          </div>
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
