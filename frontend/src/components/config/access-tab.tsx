import { useState } from "react";
import { KeyRound, Loader2, Plus, Shield, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/use-members";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-api-keys";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TenantRole } from "@/types/auth";
import type { ApiKey } from "@/types/session";

const ROLE_LABELS: Record<TenantRole, string> = {
  athlete: "Atleta",
  admin: "Administrador",
  visitor: "Visitante",
};

function PermissionsCard() {
  const { activeTenantId } = useAuth();
  const { data: members, isLoading: membersLoading } = useMembers(activeTenantId);
  const addMutation = useAddMember(activeTenantId);
  const updateRoleMutation = useUpdateMemberRole(activeTenantId);
  const removeMutation = useRemoveMember(activeTenantId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("visitor");

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

export function AccessTab() {
  return (
    <>
      <PermissionsCard />
      <ApiKeysCard />
    </>
  );
}
