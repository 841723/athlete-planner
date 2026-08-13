import { useEffect, useState } from "react";
import { Activity, CheckCircle2, ClipboardPaste, Loader2, Save, ShieldAlert, Unplug, Wifi } from "lucide-react";
import { useSyncSources, useSyncSourceMutations } from "@/hooks/use-sync-sources";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SyncSource } from "@/types/session";
import { SyncButton } from "@/components/layout/sync-button";
import { usePermissions } from "@/hooks/use-permissions";

const PROVIDER_META: Record<string, { label: string; description: string }> = {
  garmin: {
    label: "Garmin Connect",
    description: "Descarga tus actividades y sesiones desde Garmin Connect.",
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

function DateRangeEditor({ source, defaultMinDate }: { source: SyncSource; defaultMinDate?: string | null }) {
  const { toast } = useToast();
  const mutations = useSyncSourceMutations();
  const [minDate, setMinDate] = useState(source.min_date ?? defaultMinDate ?? "");
  const [maxDate, setMaxDate] = useState(source.max_date ?? "");

  useEffect(() => {
    setMinDate(source.min_date ?? defaultMinDate ?? "");
    setMaxDate(source.max_date ?? "");
  }, [source.min_date, source.max_date, defaultMinDate]);

  function handleSave() {
    mutations.updateConfig.mutate(
      { provider: source.provider, min_date: minDate || null, max_date: maxDate || null },
      {
        onSuccess: () => toast({ type: "success", title: "Rango de sincronización guardado" }),
        onError: (e) => toast({ type: "error", title: "Error al guardar", description: e.message }),
      }
    );
  }

  return (
    <div className="rounded-xl bg-dark-300/50 p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Sincronizar desde</label>
          <input type="date" className="input" value={minDate} onChange={(e) => setMinDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Hasta</label>
          <input type="date" className="input" value={maxDate} onChange={(e) => setMaxDate(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">Vacío = hasta la actualidad.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-2">
        <Button className="text-xs px-3 py-1.5" onClick={handleSave} disabled={mutations.updateConfig.isPending}>
          {mutations.updateConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar rango
        </Button>
      </div>
    </div>
  );
}

function GarminCard({ source, defaultMinDate }: { source: SyncSource; defaultMinDate?: string | null }) {
  const { toast } = useToast();
  const mutations = useSyncSourceMutations();
  const [method, setMethod] = useState<"tokens" | "password">("tokens");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tokensJson, setTokensJson] = useState("");
  const [mfaPending, setMfaPending] = useState(false);

  const pending =
    mutations.garminConnect.isPending ||
    mutations.garminMfa.isPending ||
    mutations.garminTokens.isPending ||
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

  function handleTokens() {
    if (!tokensJson.trim()) {
      toast({ type: "error", title: "Pega el JSON con los tokens de Garmin" });
      return;
    }
    mutations.garminTokens.mutate(
      { tokens: tokensJson },
      {
        onSuccess: () => {
          toast({ type: "success", title: "Garmin conectado con tus tokens" });
          setTokensJson("");
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

  const methodTab = (id: "tokens" | "password", label: string) => (
    <button
      type="button"
      onClick={() => setMethod(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        method === id
          ? "bg-accent/20 text-accent-light border border-accent/40"
          : "bg-dark-300/40 text-gray-400 border border-transparent hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );

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
          <DateRangeEditor source={source} defaultMinDate={defaultMinDate} />
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
          <div className="flex gap-1.5 mb-1">
            {methodTab("tokens", "Pegar tokens")}
            {methodTab("password", "Email y contraseña")}
          </div>

          {method === "tokens" ? (
            <>
              <div className="p-3 rounded-xl bg-dark-300/50 text-xs text-gray-400 space-y-2">
                <p className="flex items-center gap-1.5 font-medium text-gray-300">
                  <ClipboardPaste className="w-3.5 h-3.5" /> Sin compartir tu contraseña
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    En tu ordenador ejecuta:{" "}
                    <code className="text-accent-light">uv run --with garminconnect==0.3.8 python scripts/garmin-token-export.py --email TU_EMAIL</code>
                  </li>
                  <li>Introduce tu contraseña de Garmin cuando se pida. No sale de tu equipo.</li>
                  <li>Copia el JSON que imprime (empieza por <code className="text-accent-light">{"{\"tokens\": \"..."}</code>) y pégalo abajo.</li>
                </ol>
                <p>Tu contraseña de Garmin nunca se envía a esta app.</p>
              </div>
              <textarea
                className="input h-24 font-mono text-xs resize-none"
                placeholder='{"tokens": "..."}'
                value={tokensJson}
                onChange={(e) => setTokensJson(e.target.value)}
                disabled={pending}
              />
              {source.error && <p className="text-xs text-red-400">{source.error}</p>}
              <Button onClick={handleTokens} disabled={pending}>
                {mutations.garminTokens.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                Conectar con tokens
              </Button>
            </>
          ) : (
            <>
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
                La contraseña se usa una sola vez para obtener un token; no se almacena en el servidor.
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
  const perms = usePermissions();

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const garmin = data?.items.find((s) => s.provider === "garmin");
  const defaultMinDate = data?.defaultMinDate ?? null;

  return (
    <div className="grid gap-4">
      {garmin && <GarminCard source={garmin} defaultMinDate={defaultMinDate} />}
      {perms.canSync && <SyncButton />}
      <p className="text-xs text-gray-500">La sincronización manual y automática utilizan el mismo job incremental por tenant.</p>
    </div>
  );
}
