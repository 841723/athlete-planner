import { Link, useLocation } from "react-router-dom";
import { Calendar, ChartBar, ClipboardList, Home, Settings, Trophy } from "lucide-react";
import { UserMenu } from "./user-menu";
import { TenantSwitcher } from "./tenant-switcher";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import { NotificationsBell } from "@/components/ui/toast";

const baseNavItems = [
  { path: "/", label: "Inicio", icon: Home },
  { path: "/calendar", label: "Calendario", icon: Calendar },
  { path: "/weekly", label: "Semanal", icon: ChartBar },
  { path: "/stats", label: "Estadísticas", icon: Trophy },
  { path: "/trainer", label: "Entrenador", icon: ClipboardList },
];

const mobileExtra = { path: "/config/general", label: "Ajustes", icon: Settings };

export function Header() {
  const location = useLocation();
  const { activeTenantId } = useAuth();

  const navItems = baseNavItems.map((item) => ({
    ...item,
    path: tenantPath(activeTenantId, item.path),
  }));

  return (
    <>
      <header className="sticky top-0 z-40 h-[64px] md:h-[74px] glass border-b border-white/5 px-3 py-3 flex items-center justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link to={tenantPath(activeTenantId, "/")} className="flex items-center gap-2 text-[#C8102E]">
            <picture>
              <img src="/edasi-light-long.png" alt="edasi logo" className="h-8 w-auto sm:h-12" />
            </picture>
          </Link>
          <TenantSwitcher />
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`btn px-3 py-1.5 text-sm ${
                    isActive
                      ? "bg-accent/20 text-accent-light"
                      : "text-gray-400 hover:text-gray-200 hover:bg-dark-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <NotificationsBell />
          <UserMenu />
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-6 border-t border-white/10 bg-dark-200/95 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-md md:hidden">
        {[...navItems, { ...mobileExtra, path: tenantPath(activeTenantId, mobileExtra.path) }].map((item) => {
          const Icon = item.icon;
          const isActive = item.path === tenantPath(activeTenantId, "/")
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${isActive ? "text-accent-light" : "text-gray-500 hover:text-gray-200"}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${isActive ? "bg-accent/15" : ""}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
