import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/auth-context";
import { useClickOutside } from "@/hooks/use-click-outside";
import { replaceTenantInPath } from "@/lib/tenant";

const PANEL_MARGIN = 8;
const PANEL_WIDTH = 288; // 18rem

export function TenantSwitcher() {
  const { tenants, activeTenantId } = useAuth();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = tenants.find((tenant) => tenant.id === activeTenantId);

  useClickOutside(containerRef, () => setOpen(false));

  // Posiciona el panel respecto al botón, limitado a los márgenes del viewport
  // para que nunca se salga de la pantalla (ni por la derecha ni por la izquierda).
  function positionPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
    const top = (rect?.bottom ?? PANEL_MARGIN) + PANEL_MARGIN;
    const left = Math.max(
      PANEL_MARGIN,
      Math.min(rect?.left ?? PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)
    );
    setPanelPos({ top, left, width });
  }

  function toggleOpen() {
    const next = !open;
    if (next) positionPanel();
    setOpen(next);
  }

  useEffect(() => {
    if (!open) return;
    function onResize() {
      positionPanel();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  if (!active || location.pathname === "/admin" || location.pathname.startsWith("/admin/")) return null;

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-2 rounded-xl border border-dark-400 bg-dark-300/50 px-2.5 py-1.5 text-left hover:bg-dark-300 sm:max-w-[min(42vw,14rem)]"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Atleta activo: ${active.name}`}
      >
        <Users className="h-4 w-4 shrink-0 text-accent-light" />
        <span className="hidden truncate text-xs font-medium sm:inline sm:text-sm">{active.name}</span>
        <ChevronDown className={`hidden h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && panelPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="card fixed z-50 p-2 animate-scale-in"
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          >
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
