import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAdminAiLogs, fetchAdminAiUsage, fetchAdminSyncJobs } from "@/services/api";

function value(value: unknown) {
  return value == null || value === "" ? "-" : String(value);
}

export function AdminObservability() {
  const [filter, setFilter] = useState({ tenant: "", status: "", type: "", provider: "", from: "", to: "" });
  const sync = useQuery({ queryKey: ["admin-sync-jobs"], queryFn: fetchAdminSyncJobs, refetchInterval: 5000 });
  const usage = useQuery({ queryKey: ["admin-ai-usage"], queryFn: fetchAdminAiUsage, refetchInterval: 15000 });
  const logs = useQuery({ queryKey: ["admin-ai-logs"], queryFn: fetchAdminAiLogs, refetchInterval: 15000 });
  const matches = (row: Record<string, unknown>) => {
    const date = String(row.created_at ?? row.started_at ?? "");
    return (!filter.tenant || String(row.tenant_id ?? row.tenant_name).toLowerCase().includes(filter.tenant.toLowerCase()))
      && (!filter.status || row.status === filter.status)
      && (!filter.type || row.type === filter.type)
      && (!filter.provider || row.provider === filter.provider)
      && (!filter.from || date >= filter.from)
      && (!filter.to || date <= `${filter.to}T23:59:59`);
  };
  const syncRows = (sync.data ?? []).filter(matches);
  const usageRows = (usage.data ?? []).filter(matches);
  const logRows = (logs.data ?? []).filter(matches);

  return (
    <div className="space-y-5">
      <div className="card grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <input className="input text-xs" placeholder="Tenant" value={filter.tenant} onChange={(e) => setFilter({ ...filter, tenant: e.target.value })} />
        <select className="input text-xs" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">Estado</option><option value="completed">completed</option><option value="running">running</option><option value="failed">failed</option></select>
        <select className="input text-xs" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}><option value="">Tipo job</option><option value="sync">sync</option><option value="coach_chat">coach_chat</option></select>
        <input className="input text-xs" placeholder="Proveedor" value={filter.provider} onChange={(e) => setFilter({ ...filter, provider: e.target.value })} />
        <input className="input text-xs" type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
        <input className="input text-xs" type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
      </div>
      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">Sincronizaciones</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-dark-400 text-gray-500">
              <tr><th className="p-2">Tenant</th><th className="p-2">Tipo</th><th className="p-2">Estado</th><th className="p-2">Inicio</th><th className="p-2">Fin</th><th className="p-2">Error</th></tr>
            </thead>
            <tbody>
              {syncRows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-b border-dark-400/50">
                  <td className="p-2">{value(row.tenant_name)}</td>
                  <td className="p-2">{value(row.type)}</td>
                  <td className="p-2">{value(row.status)}</td>
                  <td className="p-2">{value(row.started_at ?? row.created_at)}</td>
                  <td className="p-2">{value(row.finished_at)}</td>
                  <td className="max-w-xs truncate p-2 text-red-300">{value(row.error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">Costes IA por tenant</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-dark-400 text-gray-500">
              <tr><th className="p-2">Tenant</th><th className="p-2">Proveedor</th><th className="p-2">Modelo</th><th className="p-2">Llamadas</th><th className="p-2">Tokens entrada</th><th className="p-2">Tokens salida</th><th className="p-2">Coste</th></tr>
            </thead>
            <tbody>
              {usageRows.map((row, index) => (
                <tr key={`${String(row.tenant_id)}-${index}`} className="border-b border-dark-400/50">
                  <td className="p-2">{value(row.tenant_name)}</td><td className="p-2">{value(row.provider)}</td><td className="p-2">{value(row.model)}</td><td className="p-2">{value(row.calls)}</td><td className="p-2">{value(row.input_tokens)}</td><td className="p-2">{value(row.output_tokens)}</td><td className="p-2">{value(row.cost)} {value(row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">Últimas llamadas IA</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="border-b border-dark-400 text-gray-500">
              <tr><th className="p-2">Fecha</th><th className="p-2">Tenant</th><th className="p-2">Proveedor/modelo</th><th className="p-2">Estado</th><th className="p-2">Tokens</th><th className="p-2">Coste</th><th className="p-2">Duración</th></tr>
            </thead>
            <tbody>
              {logRows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-b border-dark-400/50">
                  <td className="p-2">{value(row.created_at)}</td><td className="p-2">{value(row.tenant_name)}</td><td className="p-2">{value(row.provider)} / {value(row.model)}</td><td className="p-2">{row.ok ? "OK" : "Error"}</td><td className="p-2">{value(row.input_tokens)} / {value(row.output_tokens)}</td><td className="p-2">{value(row.cost)} {value(row.currency)}</td><td className="p-2">{value(row.duration_ms)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
