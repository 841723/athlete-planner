import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import {
  Building2,
  Target,
  Brain,
  MessageSquareText,
  Dumbbell,
  Shield,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/components/auth/auth-context";

const TABS = [
  { path: "general", label: "General", icon: Building2 },
  { path: "goals", label: "Objetivos", icon: Target },
  { path: "models", label: "IA", icon: Brain },
  { path: "prompts", label: "Prompts", icon: MessageSquareText },
  { path: "equipment", label: "Equipamiento", icon: Dumbbell },
  { path: "sync", label: "Sincronización", icon: RefreshCw },
  { path: "access", label: "Acceso", icon: Shield },
];

export function ConfigLayout() {
  const perms = usePermissions();
  const location = useLocation();
  const { user } = useAuth();
  const showAdmin = !!user?.isSuperAdmin;

  if (!perms.canManageUsers) {
    return (
      <div className="animate-fade-in">
        <div className="card p-10 text-center">
          <p className="text-gray-500">No tienes permisos para acceder a la configuración.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Nombre del atleta, perfil, objetivos, IA, sincronización y permisos del tenant.
          </p>
        </div>
        {showAdmin && (
          <Link
            to="/admin"
            className={`btn px-3 py-1.5 text-sm ${
              location.pathname.startsWith("/admin")
                ? "bg-accent/20 text-accent-light"
                : "text-gray-400 hover:text-gray-200 hover:bg-dark-300"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Administración
          </Link>
        )}
      </div>

      <div className="flex gap-1.5 bg-dark-300/40 p-1.5 rounded-xl flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = location.pathname.endsWith(`/config/${t.path}`) ||
            (t.path === "general" && location.pathname.endsWith("/config"));
          return (
            <NavLink
              key={t.path}
              to={t.path}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/20 text-accent-light"
                  : "text-gray-400 hover:text-gray-200 hover:bg-dark-300/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
