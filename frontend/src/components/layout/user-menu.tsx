import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useClickOutside } from "@/hooks/use-click-outside";
import { tenantPath } from "@/lib/tenant";

export function UserMenu() {
  const { user, activeTenantId, logout } = useAuth();
  const perms = usePermissions();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useClickOutside(containerRef, close);

  return (
    <div className="relative" ref={containerRef}>
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

              {perms.canManageUsers && (
                <Link
                  to={tenantPath(activeTenantId, "/config")}
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
