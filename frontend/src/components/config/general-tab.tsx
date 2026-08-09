import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Loader2, Save, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { updateTenantName } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/config/profile-form";

export function GeneralTab() {
  const { tenants, activeTenantId, refresh } = useAuth();
  const perms = usePermissions();
  const { toast } = useToast();

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
          <UserPlus className="w-4 h-4" /> Perfil del atleta
        </h2>
        <ProfileForm canManage={perms.canManageUsers} />
      </div>
    </>
  );
}
