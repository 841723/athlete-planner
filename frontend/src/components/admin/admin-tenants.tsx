import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useAdminTenants, useAdminTenantMembers, useAdminMutations } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminTenant } from "@/types/session";
import type { TenantRole } from "@/types/auth";

const ROLE_LABELS: Record<TenantRole, string> = {
  athlete: "Atleta",
  admin: "Administrador",
  visitor: "Visitante",
};

function CreateTenantForm() {
  const mutations = useAdminMutations();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [minDate, setMinDate] = useState("");
  const [profileJson, setProfileJson] = useState("");

  function handleCreate() {
    let profile: Record<string, unknown> | undefined;
    if (profileJson.trim()) {
      try {
        profile = JSON.parse(profileJson);
      } catch {
        toast({ type: "error", title: "El perfil no es JSON válido" });
        return;
      }
    }
    mutations.createTenant.mutate(
      {
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        slug: slug.trim() || undefined,
        minDate: minDate || undefined,
        profile,
      },
      {
        onSuccess: () => {
          toast({ type: "success", title: "Atleta creado" });
          setName("");
          setOwnerEmail("");
          setSlug("");
          setProfileJson("");
        },
        onError: (e) => toast({ type: "error", title: "Error al crear", description: e.message }),
      }
    );
  }

  return (
    <div className="card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
        <UserPlus className="w-4 h-4" /> Crear atleta
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="input w-full"
          placeholder="Nombre del atleta"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          className="input w-full"
          placeholder="Email del owner (Google)"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
        />
        <input
          className="input w-full"
          placeholder="Slug (opcional, se genera solo)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          type="date"
          className="input w-full"
          placeholder="min_date"
          value={minDate}
          onChange={(e) => setMinDate(e.target.value)}
        />
      </div>
      <textarea
        className="input w-full font-mono text-xs h-24"
        placeholder='Perfil del atleta en JSON (opcional), ej. {"name":"Sara","goal":{"date":"2027-04-18"}}'
        value={profileJson}
        onChange={(e) => setProfileJson(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleCreate}
          disabled={mutations.createTenant.isPending || !name.trim() || !ownerEmail.trim()}
        >
          {mutations.createTenant.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Crear atleta
        </Button>
      </div>
    </div>
  );
}

function TenantMembers({ tenant }: { tenant: AdminTenant }) {
  const mutations = useAdminMutations();
  const { toast } = useToast();
  const { data: members, isLoading } = useAdminTenantMembers(tenant.id);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("visitor");
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(tenant.name);

  function handleAdd() {
    mutations.addMember.mutate(
      { tenantId: tenant.id, payload: { email: email.trim(), role } },
      {
        onSuccess: () => {
          setEmail("");
          toast({ type: "success", title: "Miembro añadido" });
        },
        onError: (e) => toast({ type: "error", title: "Error", description: e.message }),
      }
    );
  }

  function handleRename() {
    mutations.renameTenant.mutate(
      { tenantId: tenant.id, name: nameDraft.trim() },
      {
        onSuccess: () => {
          setEditName(false);
          toast({ type: "success", title: "Tenant renombrado" });
        },
        onError: (e) => toast({ type: "error", title: "Error", description: e.message }),
      }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                className="input w-48 text-sm py-1.5"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
              <Button className="text-xs px-2 py-1" onClick={handleRename} disabled={mutations.renameTenant.isPending || !nameDraft.trim()}>
                Guardar
              </Button>
              <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => { setEditName(false); setNameDraft(tenant.name); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium flex items-center gap-2">
              {tenant.name}
              <button onClick={() => setEditName(true)} title="Renombrar">
                <Pencil className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
              </button>
            </p>
          )}
          <p className="text-xs text-gray-500">
            {tenant.ownerName ?? tenant.ownerEmail ?? "Sin owner"} · {tenant.membersCount} miembro
            {tenant.membersCount === 1 ? "" : "s"} · {tenant.completedCount} completadas ·{" "}
            {tenant.plannedCount} planificadas
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          className="input flex-1"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="select sm:w-44" value={role} onChange={(e) => setRole(e.target.value as TenantRole)}>
          <option value="visitor">Visitante</option>
          <option value="admin">Administrador</option>
          <option value="athlete">Atleta</option>
        </select>
        <Button onClick={handleAdd} disabled={mutations.addMember.isPending || !email.trim()}>
          {mutations.addMember.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          Añadir
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <div className="space-y-1.5">
          {members?.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-dark-300/40">
              {m.picture ? (
                <img src={m.picture} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
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
                    className="select w-32 py-1.5 text-xs"
                    value={m.role}
                    onChange={(e) =>
                      mutations.updateRole.mutate({
                        tenantId: tenant.id,
                        userId: m.id,
                        role: e.target.value as TenantRole,
                      })
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="visitor">Visitante</option>
                    <option value="athlete">Atleta</option>
                  </select>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar a ${m.name ?? m.email} del tenant?`)) {
                        mutations.removeMember.mutate({ tenantId: tenant.id, userId: m.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {members?.length === 0 && <p className="text-sm text-gray-500">Sin miembros.</p>}
        </div>
      )}
    </div>
  );
}

function TenantRow({ tenant }: { tenant: AdminTenant }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-3 rounded-xl bg-dark-300/50">
      <button
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <Users className="w-4 h-4 text-gray-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{tenant.name}</p>
          <p className="text-xs text-gray-500 truncate">{tenant.slug}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>{tenant.completedCount + tenant.plannedCount} sesiones</p>
          <p>{tenant.ownerEmail ?? "sin owner"}</p>
        </div>
      </button>
      {open && <div className="mt-3 border-t border-dark-400 pt-3"><TenantMembers tenant={tenant} /></div>}
    </div>
  );
}

export function AdminTenants() {
  const { data, isLoading } = useAdminTenants();

  return (
    <div className="space-y-4">
      <CreateTenantForm />
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Tenants
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-gray-500">No hay tenants.</p>
        ) : (
          <div className="space-y-2">
            {data.map((t) => (
              <TenantRow key={t.id} tenant={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
