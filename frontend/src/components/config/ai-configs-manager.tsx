import { useEffect, useState } from "react";
import {
  Brain,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  XCircle,
  Wallet,
  Pencil,
  TestTube2,
} from "lucide-react";
import { useAiConfigs, useAiConfigsMutations, useOpencodeModels } from "@/hooks/use-ai-configs";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiConfig, AiProviderInfo, AiProviderPricing, AiPricingValue, OpencodeModelInfo } from "@/types/session";

const FALLBACK_PROVIDERS: AiProviderInfo[] = [{ id: "gemini", name: "Google Gemini", needsApiKey: true }];

type FormState = {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  currency: string;
  pricing: Record<string, AiPricingValue>;
};

const EMPTY_FORM: FormState = {
  name: "",
  provider: "gemini",
  apiKey: "",
  model: "",
  baseUrl: "",
  currency: "EUR",
  pricing: {},
};

function formFromConfig(c: AiConfig, providers: AiProviderInfo[]): FormState {
  const needsKey = providers.find((p) => p.id === c.provider)?.needsApiKey !== false;
  const pricing = c.pricing ? { ...c.pricing } : {};
  if (!pricing[c.provider]) {
    const def = providers.find((p) => p.id === c.provider)?.defaultPricing;
    if (def) pricing[c.provider] = { ...def };
  }
  return {
    name: c.name,
    provider: c.provider,
    apiKey: needsKey ? "" : "mock",
    model: c.model ?? "",
    baseUrl: c.base_url ?? "",
    currency: c.currency,
    pricing,
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
  const [testingId, setTestingId] = useState<string | null>(null);

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
  const isOpencode = form.provider === "opencode";

  const modelsQuery = useOpencodeModels({ enabled: isOpencode });
  const opencodeModels: OpencodeModelInfo[] = (modelsQuery.data?.models ?? []).filter(
    (m) => m.enabled !== false
  );
  const modelsError = modelsQuery.data?.error;
  const selectedOpencodeModel = opencodeModels.find((m) => m.id === form.model) ?? null;
  const genericPricing = !isOpencode
    ? (form.pricing[selectedProvider?.id ?? ""] as AiProviderPricing | undefined)
    : undefined;

  function handleProviderChange(providerId: string) {
    const p = providers.find((x) => x.id === providerId);
    setForm((f) => {
      const pricing = { ...f.pricing };
      if (p?.defaultPricing && !pricing[providerId]) {
        pricing[providerId] = { ...p.defaultPricing };
      }
      return {
        ...f,
        provider: providerId,
        pricing,
        model: f.model && f.provider === providerId ? f.model : "",
      };
    });
  }

  function startNew() {
    resetForm();
    const p = providers[0];
    const pricing: Record<string, AiPricingValue> = {};
    if (p?.defaultPricing) pricing[p.id] = { ...p.defaultPricing };
    setForm({ ...EMPTY_FORM, provider: p?.id ?? "gemini", pricing });
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ type: "error", title: "Introduce un nombre para la configuración" });
      return;
    }
    if (isOpencode && !form.model.trim()) {
      toast({ type: "error", title: "Selecciona un modelo de opencode" });
      return;
    }
    const payload = isOpencode
      ? {
          name: form.name.trim(),
          provider: "opencode",
          model: form.model,
        }
      : {
          name: form.name.trim(),
          provider: form.provider,
          apiKey: form.apiKey,
          model: form.model || null,
          baseUrl: form.baseUrl || null,
          currency: form.currency.trim() || "EUR",
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
    setTestingId(c.id);
    mutations.test.mutate(c.id, {
      onSettled: () => setTestingId(null),
      onSuccess: () => toast({ type: "success", title: "Conexión correcta" }),
      onError: (err: Error) =>
        toast({ type: "error", title: "Error de conexión", description: err.message }),
    });
  }

  function patchPricing(providerId: string, field: "input_per_mtok" | "output_per_mtok", value: string) {
    const num = value === "" ? undefined : Number(value);
    setForm((f) => {
      const current = (f.pricing[providerId] ?? {}) as AiProviderPricing;
      return {
        ...f,
        pricing: { ...f.pricing, [providerId]: { ...current, [field]: num } },
      };
    });
  }

  const saveDisabled = mutations.create.isPending || mutations.update.isPending;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4" /> Configuraciones de IA
          </h2>
          {/* {!editingId && (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={startNew}
            >
              <Plus className="w-3.5 h-3.5" /> Nueva configuración
            </Button>
          )} */}
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
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      title="Probar conexión"
                      onClick={() => handleTest(c)}
                      disabled={mutations.test.isPending}
                    >
                      {testingId === c.id ? (
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
                onChange={(e) => handleProviderChange(e.target.value)}
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
              {isOpencode ? (
                <select
                  className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                  value={form.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  disabled={modelsQuery.isLoading}
                >
                  <option value="">
                    {modelsQuery.isLoading ? "Cargando modelos…" : "Selecciona un modelo…"}
                  </option>
                  {opencodeModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input w-full"
                  value={form.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  placeholder={selectedProvider?.defaultModel ?? "Modelo del proveedor"}
                />
              )}
            </div>
          </div>
          {isOpencode && (
            <div>
              {modelsError ? (
                <p className="text-xs text-red-400">
                  No se pudieron cargar los modelos desde opencode: {modelsError}
                </p>
              ) : !modelsQuery.isLoading && opencodeModels.length === 0 ? (
                <p className="text-xs text-gray-500">
                  La instancia de opencode no expone modelos habilitados.
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Modelos servidos por la instancia de opencode (solo se listan los habilitados).
                </p>
              )}
            </div>
          )}
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
              {isOpencode
                ? "OpenCode se conecta a la instancia local del sistema. No necesita API key y el modelo, la URL y el precio los gestiona el administrador."
                : "El proveedor mock no necesita API key: genera respuestas simuladas para probar sin coste."}
            </p>
          )}
          {!isOpencode && (
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
          )}

          {!isOpencode && (
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
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Precio por millón de tokens (entrada/salida) · {selectedProvider?.name}
            </label>
            {isOpencode ? (
              <div className="space-y-2">
                {selectedOpencodeModel ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] gap-2 items-center rounded-xl bg-dark-300/40 border border-dark-400 px-3 py-2">
                    <span className="text-sm text-gray-300">
                      {selectedOpencodeModel.name}{" "}
                      <span className="text-gray-500">· {selectedOpencodeModel.providerID}</span>
                    </span>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Entrada / Mtok</label>
                      <div className="text-sm font-medium text-gray-200">
                        {selectedOpencodeModel.input_per_mtok != null
                          ? `${selectedOpencodeModel.input_per_mtok.toLocaleString("es")}`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Salida / Mtok</label>
                      <div className="text-sm font-medium text-gray-200">
                        {selectedOpencodeModel.output_per_mtok != null
                          ? `${selectedOpencodeModel.output_per_mtok.toLocaleString("es")}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {modelsQuery.isLoading
                      ? "Cargando modelos…"
                      : modelsError
                        ? `No se pudieron cargar los modelos: ${modelsError}`
                        : "Selecciona un modelo para ver su precio."}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  El precio lo fija el administrador del sistema y no se puede modificar aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedProvider ? (
                  <div key={selectedProvider.id} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] gap-2 items-center">
                    <span className="text-sm text-gray-300">{selectedProvider.name}</span>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Entrada / Mtok</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input w-full py-1.5 text-sm"
                        value={genericPricing?.input_per_mtok ?? ""}
                        placeholder={selectedProvider.defaultPricing?.input_per_mtok != null ? String(selectedProvider.defaultPricing.input_per_mtok) : "0.10"}
                        onChange={(e) => patchPricing(selectedProvider.id, "input_per_mtok", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Salida / Mtok</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input w-full py-1.5 text-sm"
                        value={genericPricing?.output_per_mtok ?? ""}
                        placeholder={selectedProvider.defaultPricing?.output_per_mtok != null ? String(selectedProvider.defaultPricing.output_per_mtok) : "0.40"}
                        onChange={(e) => patchPricing(selectedProvider.id, "output_per_mtok", e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Selecciona un proveedor para configurar su precio.</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Precio fijo precargado para el proveedor; puedes cambiarlo por configuración. El coste se calcula sobre los tokens usados.
                </p>
              </div>
            )}
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
