import { useEffect } from "react";
import { Outlet, Navigate, useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";

export function TenantGuard() {
  const { tenantId } = useParams<{ tenantId?: string }>();
  const { tenants, activeTenantId, activateFromUrl } = useAuth();

  const membership = tenants.find((t) => t.id === tenantId) ?? null;

  useEffect(() => {
    if (tenantId && membership && tenantId !== activeTenantId) {
      activateFromUrl(tenantId);
    }
  }, [tenantId, membership, activeTenantId, activateFromUrl]);

  if (!tenantId) {
    return <Navigate to={tenantPath(activeTenantId, "/")} replace />;
  }

  if (!membership) {
    const defaultTenant = tenants[0]?.id ?? null;
    return (
      <div className="animate-fade-in max-w-md mx-auto">
        <div className="card p-10 text-center">
          <p className="text-2xl font-bold mb-2">Sin acceso</p>
          <p className="text-gray-500 mb-6">
            No tienes permisos para ver los datos de este atleta.
          </p>
          {defaultTenant && (
            <Link to={tenantPath(defaultTenant, "/")} className="btn btn-primary">
              Ir a mi atleta
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (tenantId !== activeTenantId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return <Outlet />;
}
