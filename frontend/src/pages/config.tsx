import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Brain,
  History,
  XCircle,
  KeyRound,
  Target,
  Dumbbell,
  FileText,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { usePrompts, useSavePrompt, useUpdatePrompt, useDeletePrompt } from "@/hooks/use-prompts";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-api-keys";
import { useAiLogs } from "@/hooks/use-ai-logs";
import { updateTenantName } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { TenantRole } from "@/types/auth";
import type { AiPrompt, ApiKey } from "@/types/session";
import { ProfileForm } from "@/components/config/profile-form";
import { GoalsTab } from "@/components/config/goals-tab";
import { EquipmentTab } from "@/components/config/equipment-tab";
import { AiConfigsManager } from "@/components/config/ai-configs-manager";

const ROLE_LABELS: Record<TenantRole, string> = {
  athlete: "Atleta",
  admin: "Administrador",
  visitor: "Visitante",
};

type ConfigTab = "general" | "ai" | "prompts" | "goals" | "equipment" | "access";

const TABS: { id: ConfigTab; label: string; icon: typeof Building2 }[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "goals", label: "Objetivos", icon: Target },
  { id: "ai", label: "IA y planes", icon: Brain },
  { id: "prompts", label: "Prompts", icon: FileText },
  { id: "equipment", label: "Equipamiento", icon: Dumbbell },
  { id: "access", label: "Acceso", icon: Shield },
];

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

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

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("visitor");

  const [tab, setTab] = useState<ConfigTab>("general");

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

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Nombre del atleta, perfil, objetivos, IA, equipamiento y permisos del tenant.
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

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Perfil del atleta
            </h2>
            <ProfileForm canManage={perms.canManageUsers} />
          </div>
        </>
      )}

      {tab === "goals" && <GoalsTab />}

      {tab === "ai" && (
        <>
          {perms.role === "athlete" ? (
            <AiConfigsManager />
          ) : (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Configuraciones de IA
              </h2>
              <p className="text-sm text-gray-400">
                Solo el atleta (rol Atleta) puede configurar la IA.
              </p>
            </div>
          )}

          <AiLogsCard />

          <p className="text-sm text-gray-500">
            Cada solicitud a un proveedor de IA (generar plan, títulos de sesión, chat, test) queda registrada en el log con sus tokens y coste.
          </p>
        </>
      )}

      {tab === "prompts" && <PromptEditorCard />}

      {tab === "equipment" && <EquipmentTab />}

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

const PAGE_SIZE = 20;

function fmtCost(cost?: number | null, currency?: string | null) {
  if (cost == null) return "—";
  const sym = CURRENCY_SYMBOLS[(currency ?? "EUR").toUpperCase()] ?? (currency ? `${currency} ` : "€");
  const value = Number(cost).toFixed(4).replace(/\.?0+$/, "");
  return `${sym}${value}`;
}

function fmtTokens(t?: number | null) {
  return t == null ? "—" : t.toLocaleString("es-ES");
}

function AiLogsCard() {
  const aiSettingsQuery = useAiSettings();
  const providers = aiSettingsQuery.data?.providers ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [okFilter, setOkFilter] = useState<"" | "ok" | "error">("");
  const [providerFilter, setProviderFilter] = useState("");
  const [page, setPage] = useState(0);

  const query = useAiLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, ok: okFilter || undefined, provider: providerFilter || undefined });

  const logs = query.data;
  const totalPages = logs ? Math.max(1, Math.ceil(logs.total / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages - 1);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <History className="w-4 h-4" /> Log de solicitudes de IA
      </h2>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="rounded-lg bg-dark-300/50 border border-dark-400 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          value={okFilter}
          onChange={(e) => {
            setOkFilter(e.target.value as "" | "ok" | "error");
            setPage(0);
          }}
        >
          <option value="">Todas</option>
          <option value="ok">Solo OK</option>
          <option value="error">Solo errores</option>
        </select>
        <select
          className="rounded-lg bg-dark-300/50 border border-dark-400 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          value={providerFilter}
          onChange={(e) => {
            setProviderFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos los proveedores</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            disabled={currentPage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-gray-500">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !logs || logs.items.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay solicitudes registradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {logs.items.map((l) => (
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
                  <span className="text-gray-600">↑{fmtTokens(l.input_tokens)} ↓{fmtTokens(l.output_tokens)}</span>
                  <span className="text-accent-light font-medium">{fmtCost(l.cost, l.currency)}</span>
                  {l.duration_ms != null && <span className="text-gray-600">{l.duration_ms}ms</span>}
                  <span className="text-gray-600 ml-auto">
                    {new Date(l.created_at).toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-gray-500">
                  <span className="truncate max-w-[24rem]">{l.endpoint}</span>
                  <span className="text-gray-600 font-mono">{l.api_key_masked ?? "—"}</span>
                </div>
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

      {logs && logs.total > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-400">
          <span className="text-xs text-gray-500">{logs.total} solicitudes</span>
          <span className="text-xs font-semibold text-accent-light">
            Total: {fmtCost(logs.costTotal, logs.currency)}
          </span>
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
