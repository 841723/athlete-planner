import { useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/auth-context";
import { replaceTenantInPath } from "@/lib/tenant";

export function TenantSwitcher() {
  const { tenants, activeTenantId } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const active = tenants.find((tenant) => tenant.id === activeTenantId);

  if (!active) return null;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        className="flex max-w-[min(42vw,14rem)] items-center gap-2 rounded-xl border border-dark-400 bg-dark-300/50 px-2.5 py-1.5 text-left hover:bg-dark-300"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Users className="h-4 w-4 shrink-0 text-accent-light" />
        <span className="truncate text-xs font-medium sm:text-sm">{active.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="card absolute left-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] p-2">
            <p className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-gray-500">
              Atleta activo
            </p>
            {tenants.map((tenant) => (
              <button
                type="button"
                key={tenant.id}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm ${tenant.id === activeTenantId ? "bg-accent/15 text-accent-light" : "text-gray-300 hover:bg-dark-300"}`}
                onClick={() => {
                  setOpen(false);
                  if (tenant.id !== activeTenantId) {
                    navigate(replaceTenantInPath(location.pathname, tenant.id));
                  }
                }}
              >
                <span className="flex-1 truncate">{tenant.name}</span>
                <span className="text-[10px] uppercase text-gray-500">{tenant.role}</span>
                {tenant.id === activeTenantId && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
