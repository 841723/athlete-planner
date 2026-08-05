import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: { type?: "success" | "error"; title: string; description?: string }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({ type = "success", title, description }: { type?: "success" | "error"; title: string; description?: string }) => {
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      setToasts((t) => [...t, { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card p-4 min-w-[260px] max-w-sm animate-scale-in shadow-xl border"
            style={{ borderColor: t.type === "success" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)" }}
          >
            <div className="flex items-start gap-2">
              {t.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
              </div>
              <button
                onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
                className="text-gray-500 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
