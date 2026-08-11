import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminSettings, useAdminMutations } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminProviderInfo } from "@/types/session";
import { AdminModels } from "@/components/admin/admin-models";
import { useOpenCodeAuth } from "@/hooks/use-admin";

export function AdminProviders() {
  const { data, isLoading } = useAdminSettings();
  const mutations = useAdminMutations();
  const { toast } = useToast();
  const authQuery = useOpenCodeAuth();
  const [openCodeProvider, setOpenCodeProvider] = useState("opencode");
  const [openCodeKey, setOpenCodeKey] = useState("");

  const [enabled, setEnabled] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(data.enabledProviders);
      setBaseUrl(data.opencodeBaseUrl);
    }
  }, [data]);

  function toggle(p: AdminProviderInfo) {
    setEnabled((prev) =>
      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
    );
  }

  function handleSave() {
    mutations.settings.mutate(
      { enabledProviders: enabled, opencodeBaseUrl: baseUrl.trim() },
      {
        onSuccess: () => toast({ type: "success", title: "Ajustes guardados" }),
        onError: (e) => toast({ type: "error", title: "Error al guardar", description: e.message }),
      }
    );
  }

  function handleConnectOpenCode() {
    const apiKey = openCodeKey.trim();
    if (!apiKey) {
      toast({ type: "error", title: "Introduce una API key de OpenCode" });
      return;
    }
    mutations.connectOpenCode.mutate(
      { providerId: openCodeProvider, apiKey },
      {
        onSuccess: () => {
          setOpenCodeKey("");
          toast({ type: "success", title: "OpenCode conectado" });
        },
        onError: (error) => toast({ type: "error", title: "No se pudo conectar OpenCode", description: error.message }),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Proveedores de IA disponibles
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Los proveedores desactivados no aparecen para los tenants y el backend rechaza sus llamadas.
        </p>
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <div className="space-y-2">
            {data?.providers.map((p) => (
              <label
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-300/50 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.id}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled.includes(p.id)}
                  onClick={() => toggle(p)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enabled.includes(p.id) ? "bg-accent" : "bg-dark-400"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      enabled.includes(p.id) ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Conexión de OpenCode
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            El usuario final no introduce nada. Aquí se conectan Zen o Go y se conservan sus credenciales dentro de OpenCode.
          </p>
        </div>

        {authQuery.data?.error && <p className="text-sm text-red-400">{authQuery.data.error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr_auto]">
          <select className="input" value={openCodeProvider} onChange={(event) => setOpenCodeProvider(event.target.value)}>
            <option value="opencode">OpenCode Zen</option>
            <option value="opencode-go">OpenCode Go</option>
          </select>
          <input
            type="password"
            className="input"
            value={openCodeKey}
            onChange={(event) => setOpenCodeKey(event.target.value)}
            placeholder="API key de OpenCode"
            autoComplete="new-password"
          />
          <Button onClick={handleConnectOpenCode} disabled={mutations.connectOpenCode.isPending}>
            {mutations.connectOpenCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Conectar
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Estado: {authQuery.data?.providers?.[openCodeProvider]?.connected ? "conectado" : "sin conectar"}
        </p>
      </div>

      <AdminModels />

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Instancia de opencode
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          URL de la instancia local de opencode que usan todos los tenants (no la pueden editar).
        </p>
        <input
          type="text"
          className="input w-full"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:4096"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutations.settings.isPending || isLoading}>
          {mutations.settings.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar ajustes
        </Button>
      </div>
    </div>
  );
}
