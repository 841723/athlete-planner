import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Bell, CheckCircle2, XCircle, X, Trash2 } from "lucide-react";
import { useClickOutside } from "@/hooks/use-click-outside";

export interface NotificationItem {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
  createdAt: string;
  read: boolean;
}

interface Toast extends NotificationItem {}

interface ToastContextValue {
  toast: (t: { type?: "success" | "error"; title: string; description?: string }) => void;
  notifications: NotificationItem[];
  markNotificationsRead: () => void;
  markOneNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const STORAGE_KEY = "athlete-planner.notifications";

function loadNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(loadNotifications);
  const toast_ttl = 4000; // Tiempo de vida de la notificación en milisegundos

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100)));
    } catch {
      // La UI sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }, [notifications]);

  const toast = useCallback(
    ({ type = "success", title, description }: { type?: "success" | "error"; title: string; description?: string }) => {
      const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      const createdAt = new Date().toISOString();
      const notification = { id, type, title, description, createdAt, read: false };
      setToasts((t) => [...t, notification]);
      setNotifications((items) => [notification, ...items].slice(0, 100));
      window.setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
      }, toast_ttl);
    },
    []
  );

  return (
      <ToastContext.Provider
          value={{
              toast,
              notifications,
              markNotificationsRead: () =>
                  setNotifications((items) =>
                      items.map((item) => ({ ...item, read: true })),
                  ),
                markOneNotificationRead: (id: string) =>
                  setNotifications((items) =>
                      items.map((item) =>
                          item.id === id ? { ...item, read: true } : item,
                      ),
                  ),
              clearNotifications: () => setNotifications([]),
              removeNotification: (id: string) =>
                setNotifications((items) => items.filter((item) => item.id !== id)),
          }}
      >
          {children}
          <div className='fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none md:left-auto md:w-[min(25rem,calc(100vw-2rem))]' aria-live='polite'>
              {toasts.map((t) => (
                  <div
                      key={t.id}
                      className='pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-dark-200/95 p-3.5 pl-4 shadow-2xl shadow-black/30 backdrop-blur-md animate-scale-in'
                      style={{
                          borderLeftColor:
                              t.type === "success"
                                  ? "#34d399"
                                  : "#fb7185",
                          borderLeftWidth: "3px",
                      }}
                  >
                      <div className='flex items-start gap-3'>
                          {t.type === "success" ? (
                               <CheckCircle2 className='mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300' />
                           ) : (
                               <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300' />
                           )}
                           <div className='min-w-0 flex-1 pr-5'>
                               <p className='text-sm font-semibold leading-5 text-white'>
                                   {t.title}
                               </p>
                               {t.description && (
                                   <p className='mt-1 text-xs leading-4 text-gray-400'>
                                       {t.description}
                                   </p>
                               )}
                          </div>
                          <button
                              onClick={() =>
                                  setToasts((ts) =>
                                      ts.filter((x) => x.id !== t.id),
                                  )
                              }
                               className='absolute right-3 top-3 text-gray-500 transition-colors hover:text-white'
                              aria-label='Cerrar'
                          >
                              <X className='w-3.5 h-3.5' />
                          </button>
                      </div>

                       <div
                           className='absolute bottom-0 left-0 h-0.5 bg-white/30'
                           style={{
                               animation: `toast-progress ${toast_ttl / 1000}s linear forwards`,
                           }}
                       />
                  </div>
              ))}
          </div>
          <style>{`@keyframes toast-progress { from { width: 100%; } to { width: 0%; } }`}</style>
      </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}

export function NotificationsBell() {
  const { notifications, markNotificationsRead, clearNotifications, removeNotification } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((item) => !item.read).length;

  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="btn-icon relative"
        title="Notificaciones"
        onClick={() => {
          setOpen((value) => !value);
          markNotificationsRead();
        }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80">
            <div className="card animate-scale-in p-2 shadow-xl">
              <div className="flex items-center justify-between border-b border-dark-400 px-2.5 py-2">
                <p className="text-sm font-semibold">Buzón de notificaciones</p>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-red-300"
                    onClick={clearNotifications}
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Vaciar
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {notifications.length === 0 ? (
                  <p className="px-2.5 py-6 text-center text-xs text-gray-500">No hay notificaciones anteriores.</p>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="flex gap-2 rounded-lg px-2.5 py-2 hover:bg-dark-300/50">
                      {item.type === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-200">{item.title}</p>
                        {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
                        <p className="mt-1 text-[10px] text-gray-600">{new Date(item.createdAt).toLocaleString("es-ES")}</p>
                      </div>
                      <button
                        onClick={() => {
                          removeNotification(item.id);
                        }}
                        className="text-gray-400 hover:text-red-400"
                        aria-label="Eliminar notificación"
                      >
                        <XCircle className="h-4 w-4 shrink-0 text-gray-400 hover:text-red-400" />
                      </button>

                    </div>

                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
