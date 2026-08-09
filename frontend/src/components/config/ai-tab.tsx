import { useState } from "react";
import { History } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { useAiLogs } from "@/hooks/use-ai-logs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiConfigsManager } from "@/components/config/ai-configs-manager";

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

function fmtCost(cost?: number | null, currency?: string | null) {
  if (cost == null) return "—";
  const sym = CURRENCY_SYMBOLS[(currency ?? "EUR").toUpperCase()] ?? (currency ? `${currency} ` : "€");
  const value = Number(cost).toFixed(4).replace(/\.?0+$/, "");
  return `${sym}${value}`;
}

function fmtTokens(t?: number | null) {
  return t == null ? "—" : t.toLocaleString("es-ES");
}

const PAGE_SIZE = 20;

function AiLogsCard() {
  const aiSettingsQuery = useAiSettings();
  const providers = aiSettingsQuery.data?.providers ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [okFilter, setOkFilter] = useState<"" | "ok" | "error">("");
  const [providerFilter, setProviderFilter] = useState("");
  const [page, setPage] = useState(0);

  const query = useAiLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, ok: okFilter || undefined, provider: providerFilter || undefined });

  const logs = query.data;
  const totalPages = logs ? Math.max(1, Math.ceil(logs.total / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages - 1);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <History className="w-4 h-4" /> Log de solicitudes de IA
      </h2>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="rounded-lg bg-dark-300/50 border border-dark-400 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          value={okFilter}
          onChange={(e) => {
            setOkFilter(e.target.value as "" | "ok" | "error");
            setPage(0);
          }}
        >
          <option value="">Todas</option>
          <option value="ok">Solo OK</option>
          <option value="error">Solo errores</option>
        </select>
        <select
          className="rounded-lg bg-dark-300/50 border border-dark-400 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          value={providerFilter}
          onChange={(e) => {
            setProviderFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos los proveedores</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            disabled={currentPage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-gray-500">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !logs || logs.items.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay solicitudes registradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {logs.items.map((l) => (
            <div key={l.id} className="p-2.5 rounded-lg bg-dark-300/30 text-xs">
              <button
                className="w-full text-left"
                onClick={() => setOpenId(openId === l.id ? null : l.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      l.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {l.ok ? "OK" : `Error${l.status ? ` ${l.status}` : ""}`}
                  </span>
                  <span className="text-gray-300 font-medium">{l.provider}</span>
                  <span className="text-gray-500">{l.model}</span>
                  <span className="text-gray-500">{l.actor}</span>
                  <span className="text-gray-600">↑{fmtTokens(l.input_tokens)} ↓{fmtTokens(l.output_tokens)}</span>
                  <span className="text-accent-light font-medium">{fmtCost(l.cost, l.currency)}</span>
                  {l.duration_ms != null && <span className="text-gray-600">{l.duration_ms}ms</span>}
                  <span className="text-gray-600 ml-auto">
                    {new Date(l.created_at).toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-gray-500">
                  <span className="truncate max-w-[24rem]">{l.endpoint}</span>
                  <span className="text-gray-600 font-mono">{l.api_key_masked ?? "—"}</span>
                </div>
                {(l.input || l.response) && (
                  <div className="mt-1.5 text-gray-500">
                    {openId === l.id ? "Ocultar input y respuesta" : "Ver input y respuesta"}
                  </div>
                )}
              </button>
              {openId === l.id && (
                <div className="mt-2 space-y-2">
                  {l.input && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Input
                      </div>
                      <pre className="max-h-60 overflow-y-auto rounded-lg bg-dark-400/40 p-2 text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px]">
                        {l.input}
                      </pre>
                    </div>
                  )}
                  {l.response && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Respuesta
                      </div>
                      <pre className="max-h-60 overflow-y-auto rounded-lg bg-dark-400/40 p-2 text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px]">
                        {l.response}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {logs && logs.total > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-400">
          <span className="text-xs text-gray-500">{logs.total} solicitudes</span>
          <span className="text-xs font-semibold text-accent-light">
            Total: {fmtCost(logs.costTotal, logs.currency)}
          </span>
        </div>
      )}
    </div>
  );
}

export function AiTab() {
  const perms = usePermissions();
  return (
    <>
      {perms.role === "athlete" ? (
        <AiConfigsManager />
      ) : (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Configuraciones de IA
          </h2>
          <p className="text-sm text-gray-400">
            Solo el atleta (rol Atleta) puede configurar la IA.
          </p>
        </div>
      )}

      <AiLogsCard />

      <p className="text-sm text-gray-500">
        Cada solicitud a un proveedor de IA (generar plan, títulos de sesión, chat, test) queda registrada en el log con sus tokens y coste.
      </p>
    </>
  );
}
