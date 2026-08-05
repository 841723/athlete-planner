import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";

export function UserMenu() {
  const { user, tenants, activeTenantId, switchTenant, logout } = useAuth();
  const perms = usePermissions();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        className="btn-icon"
        onClick={() => setOpen(!open)}
        title={user?.name ?? user?.email ?? ""}
      >
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user?.name ?? ""}
            className="w-7 aspect-square rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-full mt-2 w-64 z-50">
            <div className="card p-2 animate-scale-in">
              <div className="px-2.5 py-2 border-b border-dark-400 mb-1">
                <p className="text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              {tenants.length > 1 && (
                <div className="mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 px-2.5 pt-1.5 pb-1">
                    Cambiar de atleta
                  </p>
                  {tenants.map((t) => (
                    <button
                      key={t.id}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left ${
                        t.id === activeTenantId
                          ? "bg-accent/15 text-accent-light"
                          : "text-gray-300 hover:bg-dark-300"
                      }`}
                      onClick={() => {
                        close();
                        if (t.id !== activeTenantId) switchTenant(t.id);
                      }}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase">{t.role}</span>
                      {t.id === activeTenantId && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}

              {perms.canManageUsers && (
                <Link
                  to="/config"
                  onClick={close}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-300"
                >
                  <Settings className="w-4 h-4" /> Configuración
                </Link>
              )}

              <div className="border-t border-dark-400 mt-1 pt-1">
                <button
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-red-400 hover:bg-dark-300"
                  onClick={() => {
                    close();
                    logout();
                  }}
                >
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
