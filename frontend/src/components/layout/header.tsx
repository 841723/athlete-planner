import { Link, useLocation } from "react-router-dom";
import { Calendar, ChartBar, ClipboardList, Home, Menu, X, Trophy } from "lucide-react";
import { useState } from "react";
import { UserMenu } from "./user-menu";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";

const baseNavItems = [
  { path: "/", label: "Inicio", icon: Home },
  { path: "/calendar", label: "Calendario", icon: Calendar },
  { path: "/weekly", label: "Semanal", icon: ChartBar },
  { path: "/stats", label: "Estadísticas", icon: Trophy },
  { path: "/planned", label: "Planificadas", icon: ClipboardList },
];

export function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeTenantId } = useAuth();

  const navItems = baseNavItems.map((item) => ({
    ...item,
    path: tenantPath(activeTenantId, item.path),
  }));

  return (
    <>
      <header className="sticky top-0 z-40 glass border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="btn-icon md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <Link to={tenantPath(activeTenantId, "/")} className="flex items-center gap-2 text-[#C8102E]">
            <picture>
              <img src="/edasi-light-long.png" alt="edasi logo" className="h-12" />
            </picture>
          </Link>
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
          <UserMenu />
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
          <nav
            className="absolute left-0 top-0 h-full w-64 bg-dark-200 border-r border-white/5 p-4 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive
                      ? "bg-accent/20 text-accent-light"
                      : "text-gray-400 hover:text-gray-200 hover:bg-dark-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
