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
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useGoals, useUpdateGoals } from "@/hooks/use-goals";
import { useAiSettings, useUpdateAiSettings, useTestAiSettings } from "@/hooks/use-ai-settings";
import { useProfileHistory, useSetActiveProfileVersion, useProfileVersion } from "@/hooks/use-profile-history";
import { usePrompts, useSavePrompt, useUpdatePrompt, useDeletePrompt } from "@/hooks/use-prompts";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-api-keys";
import { useAiLogs } from "@/hooks/use-ai-logs";
import { updateTenantName, fetchProfileVersion } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { TenantRole } from "@/types/auth";
import type { RaceGoal, ProfileVersion, AiPrompt, ApiKey } from "@/types/session";
import { lineDiff, type DiffLine } from "@/lib/diff";

const ROLE_LABELS: Record<TenantRole, string> = {
  athlete: "Atleta",
  admin: "Administrador",
  visitor: "Visitante",
};

const PROVIDER_LABELS: { id: string; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic Claude" },
  { id: "openai_compatible", label: "OpenAI-compatible (endpoint propio)" },
];

type ConfigTab = "general" | "ai" | "access";

const TABS: { id: ConfigTab; label: string; icon: typeof Building2 }[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "ai", label: "IA y planes", icon: Brain },
  { id: "access", label: "Acceso", icon: Shield },
];

function emptyGoal(): RaceGoal {
  return { week: 0, label: "", date: "", targetPace: "", url: "", isPrimary: false };
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
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  useEffect(() => {
    if (aiSettingsQuery.data?.provider) setAiProvider(aiSettingsQuery.data.provider);
    if (aiSettingsQuery.data?.model) setAiModel(aiSettingsQuery.data.model);
    if (aiSettingsQuery.data?.base_url) setAiBaseUrl(aiSettingsQuery.data.base_url);
  }, [aiSettingsQuery.data]);

  const [tab, setTab] = useState<ConfigTab>("general");

  const profileHistoryQuery = useProfileHistory();
  const setActiveVersionMutation = useSetActiveProfileVersion();
  const [restoreCandidate, setRestoreCandidate] = useState<{
    version: ProfileVersion;
    left: DiffLine[];
    right: DiffLine[];
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  async function handleRestoreVersion(version: ProfileVersion) {
    if (!profileQuery.data) {
      setActiveVersionMutation.mutate(version.id);
      return;
    }
    setDiffLoading(true);
    try {
      const [current, target] = await Promise.all([
        Promise.resolve(profileQuery.data),
        fetchProfileVersion(version.id),
      ]);
      const currentJson = JSON.stringify(current, null, 2);
      const targetJson = JSON.stringify(target.data, null, 2);
      setRestoreCandidate({
        version,
        left: lineDiff(currentJson, targetJson),
        right: lineDiff(targetJson, currentJson),
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
    if (Object.keys(parsed).length === 0) {
      toast({ type: "error", title: "Perfil vacío", description: "El perfil no puede estar vacío." });
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
      baseUrl: aiBaseUrl,
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

      <div className="flex gap-1.5 bg-dark-300/40 p-1.5 rounded-xl flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/20 text-accent-light"
                  : "text-gray-400 hover:text-gray-200 hover:bg-dark-300/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "general" && (
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
        </>
      )}

      {tab === "ai" && (
        <>
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
                  {PROVIDER_LABELS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  {(aiSettingsQuery.data?.providers ?? []).map((p) =>
                    PROVIDER_LABELS.some((x) => x.id === p) ? null : (
                      <option key={p} value={p}>{p}</option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Modelo</label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder={aiSettingsQuery.data?.model ?? "Modelo del proveedor"}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">API Key</label>
              <input
                type="password"
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={aiSettingsQuery.data ? "•••••••• (guardada)" : "Introduce tu API key del proveedor"}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Base URL (opcional)</label>
              <input
                type="text"
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="https://… (endpoint base del proveedor)"
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

      <PromptEditorCard />

      <AiLogsCard />

      <p className="text-sm text-gray-500">
        Cada solicitud a un proveedor de IA (generar plan, títulos de sesión, test) queda registrada en el log.
      </p>
        </>
      )}

      {tab === "general" && (
      <>
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
              <AutoTextarea
                className="input w-full font-mono text-xs"
                minRows={10}
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
                        onClick={() => handleRestoreVersion(v)}
                        disabled={setActiveVersionMutation.isPending || diffLoading}
                      >
                        {diffLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Recuperar
                      </Button>
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
                      {restoreCandidate.left.map((l, i) => (
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
                      {restoreCandidate.right.map((l, i) => (
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
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setRestoreCandidate(null)}
                  >
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
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[5rem_1fr_9rem_7rem_1fr_auto] gap-2 items-center">
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
                <input
                  className="input py-1.5 text-sm"
                  placeholder="URL de la carrera"
                  value={g.url ?? ""}
                  onChange={(e) => patchGoal(i, { url: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={g.isPrimary ?? false}
                      onChange={(e) =>
                        setGoals((gs) =>
                          gs.map((goal, j) => (j === i ? { ...goal, isPrimary: e.target.checked } : { ...goal, isPrimary: false }))
                        )
                      }
                    />
                    Principal
                  </label>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                    onClick={() => setGoals((gs) => gs.filter((_, j) => j !== i))}
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
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
      </>
      )}

      {tab === "access" && (
      <>
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

      <ApiKeysCard />
      </>
      )}
    </div>
  );
}

function PromptEditorCard() {
  const { data: prompts, isLoading } = usePrompts();
  const saveMutation = useSavePrompt();
  const updateMutation = useUpdatePrompt();
  const deleteMutation = useDeletePrompt();
  const [edits, setEdits] = useState<Record<string, { name: string; content: string }>>({});
  const [newPrompts, setNewPrompts] = useState<{ id: string; name: string; content: string }[]>([]);
  const [newCounter, setNewCounter] = useState(0);

  useEffect(() => {
    if (!prompts) return;
    setEdits((e) => {
      const next = { ...e };
      for (const p of prompts) {
        if (!next[p.id]) next[p.id] = { name: p.name, content: p.content };
      }
      return next;
    });
  }, [prompts]);

  function valueFor(p: AiPrompt) {
    return edits[p.id] ?? { name: p.name, content: p.content };
  }

  function patchEdit(id: string, patch: Partial<{ name: string; content: string }>) {
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? { name: "", content: "" }), ...patch } }));
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" /> Prompts de IA
        </h2>
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => {
            setNewPrompts((n) => [...n, { id: `new-${newCounter}`, name: "", content: "" }]);
            setNewCounter((c) => c + 1);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo prompt
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {prompts?.map((p) => {
            const val = valueFor(p);
            const predefined = !!p.is_predefined;
            const dirty = val.name !== p.name || val.content !== p.content;
            return (
              <div key={p.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2">
                <div className="flex items-center gap-2">
                  {predefined ? (
                    <span className="text-sm font-medium text-gray-300 truncate">{p.name}</span>
                  ) : (
                    <input
                      className="input flex-1 py-1.5 text-sm"
                      value={val.name}
                      onChange={(e) => patchEdit(p.id, { name: e.target.value })}
                    />
                  )}
                  {predefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-dark-400/50 text-gray-400">
                      Predefinido
                    </span>
                  )}
                </div>
                <AutoTextarea
                  className="input w-full font-mono text-xs"
                  minRows={7}
                  value={val.content}
                  onChange={(e) => !predefined && patchEdit(p.id, { content: e.target.value })}
                  spellCheck={false}
                  readOnly={predefined}
                />
                {!predefined && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      className="text-xs px-2 py-1"
                      onClick={() => updateMutation.mutate({ promptId: p.id, payload: { name: val.name, content: val.content } })}
                      disabled={!dirty || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {newPrompts.map((np) => (
            <div key={np.id} className="p-3 rounded-xl bg-dark-300/50 space-y-2 border border-accent/40">
              <div className="text-[10px] font-semibold text-accent uppercase tracking-wide">Nuevo prompt</div>
              <input
                className="input w-full py-1.5 text-sm"
                placeholder="Nombre del prompt"
                value={np.name}
                onChange={(e) =>
                  setNewPrompts((ns) => ns.map((n) => (n.id === np.id ? { ...n, name: e.target.value } : n)))
                }
              />
              <AutoTextarea
                className="input w-full font-mono text-xs"
                minRows={7}
                placeholder="Contenido del prompt..."
                value={np.content}
                onChange={(e) =>
                  setNewPrompts((ns) => ns.map((n) => (n.id === np.id ? { ...n, content: e.target.value } : n)))
                }
                spellCheck={false}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                  onClick={() => setNewPrompts((ns) => ns.filter((n) => n.id !== np.id))}
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
                <Button
                  className="text-xs px-2 py-1"
                  onClick={() => {
                    saveMutation.mutate({ name: np.name, content: np.content }, {
                      onSuccess: () => setNewPrompts((ns) => ns.filter((n) => n.id !== np.id)),
                    });
                  }}
                  disabled={saveMutation.isPending || !np.name.trim() || !np.content.trim()}
                >
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Crear
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Los prompts predefinidos son de solo lectura. Los personalizados puedes editarlos y usarlos al generar un plan.
          </p>
        </div>
      )}
    </div>
  );
}

function AiLogsCard() {
  const { data: logs, isLoading } = useAiLogs(50);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <History className="w-4 h-4" /> Log de solicitudes de IA
      </h2>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !logs || logs.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay solicitudes registradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="p-2.5 rounded-lg bg-dark-300/30 text-xs">
              <button
                className="w-full text-left"
                onClick={() => setOpenId(openId === l.id ? null : l.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      l.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {l.ok ? "OK" : `Error${l.status ? ` ${l.status}` : ""}`}
                  </span>
                  <span className="text-gray-300 font-medium">{l.provider}</span>
                  <span className="text-gray-500">{l.model}</span>
                  <span className="text-gray-500">{l.actor}</span>
                  {l.duration_ms != null && <span className="text-gray-600">{l.duration_ms}ms</span>}
                  <span className="text-gray-600 ml-auto">
                    {new Date(l.created_at).toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-gray-500">
                  <span className="truncate max-w-[24rem]">{l.endpoint}</span>
                  <span className="text-gray-600 font-mono">{l.api_key_masked ?? "—"}</span>
                </div>
                {openId === l.id && l.status != null && (
                  <div className="mt-1.5 text-gray-400">Status HTTP: {l.status}</div>
                )}
                {(l.input || l.response) && (
                  <div className="mt-1.5 text-gray-500">
                    {openId === l.id ? "Ocultar input y respuesta" : "Ver input y respuesta"}
                  </div>
                )}
              </button>
              {openId === l.id && (
                <div className="mt-2 space-y-2">
                  {l.input && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Input
                      </div>
                      <pre className="max-h-60 overflow-y-auto rounded-lg bg-dark-400/40 p-2 text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px]">
                        {l.input}
                      </pre>
                    </div>
                  )}
                  {l.response && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Respuesta
                      </div>
                      <pre className="max-h-60 overflow-y-auto rounded-lg bg-dark-400/40 p-2 text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px]">
                        {l.response}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeysCard() {
  const { data: keys, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "visitor">("admin");
  const [revealed, setRevealed] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) {
      toast({ type: "error", title: "Introduce un nombre para la API key" });
      return;
    }
    createMutation.mutate(
      { name: name.trim(), role },
      {
        onSuccess: (data) => {
          setRevealed(data.apiKey);
          setName("");
          toast({ type: "success", title: "API key creada", description: "Cópiala ahora: solo se muestra una vez." });
        },
      }
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <KeyRound className="w-4 h-4" /> API Keys
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Usa estas claves para acceder a la API del tenant sin iniciar sesión con Google (cabecera{" "}
        <code className="text-gray-400">Authorization: Bearer &lt;clave&gt;</code> o{" "}
        <code className="text-gray-400">X-Api-Key: &lt;clave&gt;</code>).
      </p>

      {revealed && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/40 mb-3 space-y-2">
          <div className="text-[10px] font-semibold text-accent uppercase tracking-wide">
            Nueva API key (cópiala, no se vuelve a mostrar)
          </div>
          <code className="block text-xs text-accent-light break-all font-mono">{revealed}</code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(revealed).catch(() => {});
              setRevealed(null);
            }}
            className="text-xs text-accent-light underline"
          >
            Copiada, cerrar
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          className="input flex-1"
          placeholder="Nombre (ej. Integración con mi web)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="select sm:w-44"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "visitor")}
        >
          <option value="admin">Administrador</option>
          <option value="visitor">Visitante</option>
        </select>
        <Button onClick={handleCreate} disabled={createMutation.isPending || !name.trim()}>
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : !keys || keys.length === 0 ? (
        <p className="text-sm text-gray-500">No hay API keys creadas.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k: ApiKey) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-dark-300/50">
              <KeyRound className="w-4 h-4 text-gray-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {k.name}
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      k.role === "admin" ? "bg-accent/20 text-accent-light" : "bg-dark-400/50 text-gray-400"
                    }`}
                  >
                    {k.role === "admin" ? "Admin" : "Visitante"}
                  </span>
                </p>
                <p className="text-xs text-gray-500 font-mono">{k.prefix}•••</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600">
                  {k.last_used_at
                    ? `Usada ${new Date(k.last_used_at).toLocaleDateString("es-ES")}`
                    : "Sin usar"}
                </span>
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                  onClick={() => {
                    if (window.confirm(`¿Revocar la API key "${k.name}"?`)) {
                      deleteMutation.mutate(k.id);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
