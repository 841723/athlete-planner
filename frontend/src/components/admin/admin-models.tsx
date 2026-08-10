import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminOpencodeModels, useAdminMutations } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpencodeModelInfo } from "@/types/session";

type Row = {
  model: OpencodeModelInfo;
  enabled: boolean;
  input: string;
  output: string;
};

function ModelRow({ row, onChange, onSave, saving }: {
  row: Row;
  onChange: (next: Row) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const pricePlaceholder = (v: number | null | undefined) =>
    v != null ? String(v) : "—";

  return (
    <div className="p-3 rounded-xl bg-dark-300/50 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {row.model.name || row.model.id}
            {row.model.overridden && (
              <span className="ml-2 text-[10px] text-accent-light uppercase">precio propio</span>
            )}
          </p>
          <p className="text-xs text-gray-500 font-mono truncate">
            {row.model.id} · {row.model.providerID}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={row.enabled}
          onClick={() => onChange({ ...row, enabled: !row.enabled })}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
            row.enabled ? "bg-accent" : "bg-dark-400"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              row.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] gap-2 items-end">
        <span className="text-xs text-gray-500 self-center">
          Precio por millón de tokens (en blanco = precio de la instancia)
        </span>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Entrada / Mtok</label>
          <input
            type="number"
            step="any"
            min="0"
            className="input w-full py-1.5 text-sm"
            value={row.input}
            placeholder={pricePlaceholder(row.model.input_per_mtok)}
            onChange={(e) => onChange({ ...row, input: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Salida / Mtok</label>
          <input
            type="number"
            step="any"
            min="0"
            className="input w-full py-1.5 text-sm"
            value={row.output}
            placeholder={pricePlaceholder(row.model.output_per_mtok)}
            onChange={(e) => onChange({ ...row, output: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" className="text-xs" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

export function AdminModels() {
  const { data, isLoading } = useAdminOpencodeModels();
  const mutations = useAdminMutations();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      const known = new Map(prev.map((r) => [r.model.id, r]));
      return (data.models ?? []).map((m) => {
        const existing = known.get(m.id);
        return existing
          ? { ...existing, model: m }
          : { model: m, enabled: m.enabled, input: "", output: "" };
      });
    });
  }, [data]);

  function saveRow(r: Row) {
    setSavingId(r.model.id);
    mutations.model.mutate(
      {
        modelId: r.model.id,
        payload: {
          name: r.model.name,
          providerId: r.model.providerID,
          enabled: r.enabled,
          inputPrice: r.input === "" ? null : Number(r.input),
          outputPrice: r.output === "" ? null : Number(r.output),
        },
      },
      {
        onSuccess: () => {
          setSavingId(null);
          setRows((prev) => prev.map((x) => (x.model.id === r.model.id ? { ...x, input: "", output: "" } : x)));
          toast({ type: "success", title: "Modelo actualizado" });
        },
        onError: (e) => {
          setSavingId(null);
          toast({ type: "error", title: "Error al guardar", description: e.message });
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Modelos de opencode
          </h2>
          {data?.baseUrl && <span className="text-xs text-gray-500 font-mono">{data.baseUrl}</span>}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Activa los modelos disponibles para los tenants y fija su precio. Los que no actives no
          se pueden usar en ninguna configuración de IA.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : data?.error ? (
          <p className="text-sm text-red-400">
            No se pudo conectar con la instancia de opencode: {data.error}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">La instancia de opencode no expone modelos.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <ModelRow
                key={r.model.id}
                row={r}
                saving={savingId === r.model.id}
                onChange={(next) =>
                  setRows((prev) => prev.map((x) => (x.model.id === r.model.id ? next : x)))
                }
                onSave={() => saveRow(r)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
