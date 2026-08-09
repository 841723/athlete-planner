import { useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Unplug, Wifi } from "lucide-react";
import { useSyncSources, useSyncSourceMutations } from "@/hooks/use-sync-sources";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SyncSource } from "@/types/session";

const PROVIDER_META: Record<string, { label: string; description: string }> = {
  garmin: {
    label: "Garmin Connect",
    description: "Descarga tus actividades, sesiones y tracks desde Garmin Connect.",
  },
  strava: {
    label: "Strava",
    description: "Importa actividades desde Strava (autenticación vía OAuth).",
  },
};

function StatusBadge({ source }: { source: SyncSource }) {
  if (source.status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-medium">
        <CheckCircle2 className="w-3 h-3" /> Conectado
      </span>
    );
  }
  if (source.status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-medium">
        <Loader2 className="w-3 h-3 animate-spin" /> Conectando…
      </span>
    );
  }
  if (source.error) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-medium">
        <ShieldAlert className="w-3 h-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 text-xs font-medium">
      <Wifi className="w-3 h-3" /> No conectado
    </span>
  );
}

function GarminCard({ source }: { source: SyncSource }) {
  const { toast } = useToast();
  const mutations = useSyncSourceMutations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaPending, setMfaPending] = useState(false);

  const pending =
    mutations.garminConnect.isPending ||
    mutations.garminMfa.isPending ||
    mutations.disconnect.isPending;

  function handleConnect() {
    if (!email.trim() || !password) {
      toast({ type: "error", title: "Introduce email y contraseña de Garmin" });
      return;
    }
    mutations.garminConnect.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (data) => {
          if (data.mfaRequired) {
            setMfaPending(true);
            setPassword(password);
          } else {
            toast({ type: "success", title: "Garmin conectado" });
            setEmail("");
            setPassword("");
          }
        },
        onError: (e) => toast({ type: "error", title: "No se pudo conectar Garmin", description: e.message }),
      }
    );
  }

  function handleMfa() {
    if (!code.trim()) {
      toast({ type: "error", title: "Introduce el código de verificación" });
      return;
    }
    mutations.garminMfa.mutate(
      { email: email.trim(), password, code: code.trim() },
      {
        onSuccess: () => {
          toast({ type: "success", title: "Garmin conectado" });
          setMfaPending(false);
          setEmail("");
          setPassword("");
          setCode("");
        },
        onError: (e) => toast({ type: "error", title: "Código incorrecto", description: e.message }),
      }
    );
  }

  function handleDisconnect() {
    if (window.confirm("¿Desconectar Garmin Connect? Las sesiones ya importadas se conservan.")) {
      mutations.disconnect.mutate("garmin");
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent-light flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-300">{PROVIDER_META.garmin.label}</h2>
            <p className="text-xs text-gray-500">{PROVIDER_META.garmin.description}</p>
          </div>
        </div>
        <StatusBadge source={source} />
      </div>

      {source.status === "connected" ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-dark-300/50 text-sm">
            <p className="text-gray-300">
              Cuenta: <span className="text-gray-100 font-medium">{source.account_name ?? "—"}</span>
            </p>
            {source.min_date && (
              <p className="text-xs text-gray-500 mt-1">Sincroniza desde {source.min_date}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="text-xs px-3 py-1.5 text-red-400 hover:text-red-300"
              onClick={handleDisconnect}
              disabled={pending}
            >
              {mutations.disconnect.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <input
              type="email"
              className="input"
              placeholder="Email de Garmin"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <input
              type="password"
              className="input"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </div>
          {mfaPending && (
            <div>
              <input
                type="text"
                className="input"
                placeholder="Código de verificación (6 dígitos)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-gray-500 mt-1">
                Garmin te ha enviado un código de verificación (email o SMS).
              </p>
            </div>
          )}
          {source.error && <p className="text-xs text-red-400">{source.error}</p>}
          <Button
            onClick={mfaPending ? handleMfa : handleConnect}
            disabled={pending}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {mfaPending ? "Verificar y conectar" : "Conectar Garmin"}
          </Button>
          <p className="text-xs text-gray-500">
            Las credenciales se envían solo al login de Garmin; no se almacenan en el servidor.
          </p>
        </div>
      )}
    </div>
  );
}

function StravaCard({ source, stravaConfigured }: { source: SyncSource; stravaConfigured: boolean }) {
  const { toast } = useToast();
  const mutations = useSyncSourceMutations();
  const { refetch } = useSyncSources();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleConnect() {
    try {
      const { url } = await mutations.stravaConnect.mutateAsync();
      window.open(url, "_blank");
      toast({ type: "success", title: "Autoriza en la nueva pestaña", description: "Al volver se conectará automáticamente." });
      pollRef.current = setInterval(async () => {
        const data = await refetch();
        if (data.data?.items.some((s) => s.provider === "strava" && s.status === "connected")) {
          stopPolling();
          toast({ type: "success", title: "Strava conectado" });
        }
      }, 3000);
    } catch (e) {
      toast({ type: "error", title: "No se pudo iniciar la conexión con Strava", description: (e as Error).message });
    }
  }

  function handleDisconnect() {
    if (window.confirm("¿Desconectar Strava? Las sesiones ya importadas se conservan.")) {
      mutations.disconnect.mutate("strava");
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent-light flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-300">{PROVIDER_META.strava.label}</h2>
            <p className="text-xs text-gray-500">{PROVIDER_META.strava.description}</p>
          </div>
        </div>
        <StatusBadge source={source} />
      </div>

      {source.status === "connected" ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-dark-300/50 text-sm">
            <p className="text-gray-300">
              Cuenta: <span className="text-gray-100 font-medium">{source.account_name ?? "—"}</span>
            </p>
            {source.min_date && (
              <p className="text-xs text-gray-500 mt-1">Sincroniza desde {source.min_date}</p>
            )}
          </div>
          <Button
            variant="ghost"
            className="text-xs px-3 py-1.5 text-red-400 hover:text-red-300 w-fit"
            onClick={handleDisconnect}
            disabled={mutations.disconnect.isPending}
          >
            {mutations.disconnect.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!stravaConfigured ? (
            <p className="text-xs text-red-400">
              Strava no está configurado en el servidor. Añade STRAVA_CLIENT_ID y STRAVA_CLIENT_SECRET en el .env.
            </p>
          ) : (
            <>
              <Button onClick={handleConnect} disabled={mutations.stravaConnect.isPending}>
                {mutations.stravaConnect.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Conectar con Strava
              </Button>
              <p className="text-xs text-gray-500">
                Se abrirá una ventana de autorización de Strava. No es necesario guardar credenciales aquí.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SyncTab() {
  const { data, isLoading } = useSyncSources();

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const garmin = data?.items.find((s) => s.provider === "garmin");
  const strava = data?.items.find((s) => s.provider === "strava");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {garmin && <GarminCard source={garmin} />}
      {strava && <StravaCard source={strava} stravaConfigured={!!data?.stravaConfigured} />}
      <p className="text-xs text-gray-500 lg:col-span-2">
        El botón Sincronizar de Inicio usa la fuente conectada. Solo puede haber una fuente activa a la vez.
      </p>
    </div>
  );
}
