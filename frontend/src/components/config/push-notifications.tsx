import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  deletePushSubscription,
  fetchPushConfig,
  savePushSubscription,
} from "@/services/api";

function base64ToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushNotifications() {
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function enable() {
    if (!activeTenantId || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({ type: "error", title: "Este navegador no admite notificaciones push" });
      return;
    }
    setBusy(true);
    try {
      const config = await fetchPushConfig();
      if (!config.enabled || !config.publicKey) throw new Error("El servidor no tiene VAPID configurado");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permiso de notificaciones no concedido");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(config.publicKey),
      });
      await savePushSubscription(subscription.toJSON());
      toast({ type: "success", title: "Notificaciones activadas" });
    } catch (err) {
      toast({ type: "error", title: "No se pudieron activar", description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      toast({ type: "success", title: "Notificaciones desactivadas" });
    } catch (err) {
      toast({ type: "error", title: "No se pudieron desactivar", description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const granted = "Notification" in window && Notification.permission === "granted";
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
        {granted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />} Notificaciones
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Recibe avisos en este dispositivo. El permiso solo se solicita al pulsar activar.
      </p>
      {granted ? (
        <Button variant="outline" onClick={disable} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />} Desactivar
        </Button>
      ) : (
        <Button onClick={enable} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Activar notificaciones
        </Button>
      )}
    </div>
  );
}
