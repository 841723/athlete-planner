import { useEffect, useState } from "react";
import {
  Brain,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  XCircle,
  Clock,
  Wallet,
  Pencil,
  TestTube2,
} from "lucide-react";
import { useAiConfigs, useAiConfigsMutations } from "@/hooks/use-ai-configs";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiConfig, AiProviderInfo, AiProviderPricing } from "@/types/session";

const FALLBACK_PROVIDERS: AiProviderInfo[] = [{ id: "gemini", name: "Google Gemini", needsApiKey: true }];

const CHAT_DURATION_OPTIONS = [
  { value: "24", label: "24 horas" },
  { value: "48", label: "48 horas" },
  { value: "72", label: "72 horas" },
  { value: "168", label: "1 semana" },
  { value: "0", label: "Sin límite" },
];

type FormState = {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  currency: string;
  chatDuration: string;
  pricing: Record<string, AiProviderPricing>;
};

const EMPTY_FORM: FormState = {
  name: "",
  provider: "gemini",
  apiKey: "",
  model: "",
  baseUrl: "",
  currency: "EUR",
  chatDuration: "24",
  pricing: {},
};

function formFromConfig(c: AiConfig, providers: AiProviderInfo[]): FormState {
  const needsKey = providers.find((p) => p.id === c.provider)?.needsApiKey !== false;
  return {
    name: c.name,
    provider: c.provider,
    apiKey: needsKey ? "" : "mock",
    model: c.model ?? "",
    baseUrl: c.base_url ?? "",
    currency: c.currency,
    chatDuration: c.chat_duration_hours == null ? "0" : String(c.chat_duration_hours),
    pricing: c.pricing ?? {},
  };
}

export function AiConfigsManager() {
  const { data, isLoading } = useAiConfigs();
  const mutations = useAiConfigsMutations();
  const { toast } = useToast();

  const providers: AiProviderInfo[] =
    data?.providers?.length ? data.providers : FALLBACK_PROVIDERS;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(c: AiConfig) {
    setForm(formFromConfig(c, providers));
    setEditingId(c.id);
  }

  const selectedProvider = providers.find((p) => p.id === form.provider);

  function handleSave() {
    if (!form.name.trim()) {
      toast({ type: "error", title: "Introduce un nombre para la configuración" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey,
      model: form.model || null,
      baseUrl: form.baseUrl || null,
      currency: form.currency.trim() || "EUR",
      chatDurationHours: form.chatDuration === "0" ? 0 : Number(form.chatDuration),
      pricing: form.pricing,
    };
    const options = {
      onSuccess: () => {
        toast({ type: "success", title: editingId ? "Configuración actualizada" : "Configuración creada" });
        resetForm();
      },
      onError: (err: Error) =>
        toast({ type: "error", title: "Error al guardar", description: err.message }),
    };
    if (editingId) {
      mutations.update.mutate({ id: editingId, payload }, options);
    } else {
      mutations.create.mutate(payload, options);
    }
  }

  function handleTest(c: AiConfig) {
    mutations.test.mutate(c.id, {
      onSuccess: () => toast({ type: "success", title: "Conexión correcta" }),
      onError: (err: Error) =>
        toast({ type: "error", title: "Error de conexión", description: err.message }),
    });
  }

  function patchPricing(providerId: string, field: "input_per_mtok" | "output_per_mtok", value: string) {
    const num = value === "" ? undefined : Number(value);
    setForm((f) => ({
      ...f,
      pricing: {
        ...f.pricing,
        [providerId]: { ...(f.pricing[providerId] ?? {}), [field]: num },
      },
    }));
  }

  const saveDisabled =
    mutations.create.isPending || mutations.update.isPending || !form.name.trim();

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4" /> Configuraciones de IA
          </h2>
          {!editingId && (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => {
                resetForm();
                setForm({ ...EMPTY_FORM, provider: providers[0]?.id ?? "gemini" });
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Nueva configuración
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Define una o varias configuraciones (proveedor, modelo y costes) y elige cuál es la
          predeterminada. Se usan para generar planes, títulos y chats.
        </p>

        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : data && data.items.length === 0 && !editingId ? (
          <div className="p-4 rounded-xl bg-dark-300/40 text-sm text-gray-400">
            Todavía no hay configuraciones. Crea la primera para poder generar planes.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.items.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded-xl bg-dark-300/50 border ${
                  c.is_default ? "border-accent/50" : "border-dark-400"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {c.is_default && (
                    <Star className="w-4 h-4 text-accent-light fill-accent-light" />
                  )}
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-gray-400">{c.provider}</span>
                  {c.model && <span className="text-xs text-gray-500">{c.model}</span>}
                  <span className="text-xs text-gray-600">Chat {c.chatDurationLabel ?? `${c.chat_duration_hours}h`}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      title="Probar conexión"
                      onClick={() => handleTest(c)}
                      disabled={mutations.test.isPending}
                    >
                      {mutations.test.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <TestTube2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    {!c.is_default && (
                      <Button
                        variant="ghost"
                        className="text-xs px-2 py-1 text-accent-light"
                        title="Usar por defecto"
                        onClick={() => mutations.setDefault.mutate(c.id)}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      title="Editar"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                      title="Eliminar"
                      disabled={c.is_default}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la configuración "${c.name}"?`)) {
                          mutations.remove.mutate(c.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          {editingId ? "Editar configuración" : "Nueva configuración"}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Nombre</label>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Ej. Gemini para planes"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Proveedor</label>
              <select
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                value={form.provider}
                onChange={(e) => patch({ provider: e.target.value })}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Modelo</label>
              <input
                type="text"
                className="input w-full"
                value={form.model}
                onChange={(e) => patch({ model: e.target.value })}
                placeholder={selectedProvider?.defaultModel ?? "Modelo del proveedor"}
              />
            </div>
          </div>
          {selectedProvider?.needsApiKey !== false && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">API Key</label>
              <input
                type="password"
                className="input w-full"
                value={form.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder={editingId ? "•••••••• (guardada, deja en blanco para no cambiarla)" : "API key del proveedor"}
              />
            </div>
          )}
          {selectedProvider?.needsApiKey === false && (
            <p className="text-xs text-gray-500">
              El proveedor mock no necesita API key: genera respuestas simuladas para probar sin coste.
            </p>
          )}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Base URL (opcional)</label>
            <input
              type="text"
              className="input w-full"
              value={form.baseUrl}
              onChange={(e) => patch({ baseUrl: e.target.value })}
              placeholder="https://… (endpoint base del proveedor)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ventana de chat
              </label>
              <select
                className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                value={form.chatDuration}
                onChange={(e) => patch({ chatDuration: e.target.value })}
              >
                {CHAT_DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Moneda
              </label>
              <input
                type="text"
                className="input w-full uppercase"
                value={form.currency}
                onChange={(e) => patch({ currency: e.target.value })}
                placeholder="EUR"
                maxLength={3}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Precio por millón de tokens (entrada/salida)
            </label>
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] gap-2 items-center">
                  <span className="text-sm text-gray-300">{p.name}</span>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Entrada / Mtok</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input w-full py-1.5 text-sm"
                      value={form.pricing[p.id]?.input_per_mtok ?? ""}
                      placeholder="0.10"
                      onChange={(e) => patchPricing(p.id, "input_per_mtok", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Salida / Mtok</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input w-full py-1.5 text-sm"
                      value={form.pricing[p.id]?.output_per_mtok ?? ""}
                      placeholder="0.40"
                      onChange={(e) => patchPricing(p.id, "output_per_mtok", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saveDisabled}>
              {mutations.create.isPending || mutations.update.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingId ? "Guardar cambios" : "Crear configuración"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={resetForm}>
                <XCircle className="w-4 h-4" /> Cancelar
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            La API key se guarda cifrada y solo se usa para las solicitudes al proveedor. La
            configuración predeterminada es la que se usa por defecto al generar planes.
          </p>
        </div>
      </div>
    </div>
  );
}
