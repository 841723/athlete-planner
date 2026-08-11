import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Save,
  Server,
  Star,
  TestTube2,
  Trash2,
} from "lucide-react";

import { useAiConfigs, useAiConfigsMutations, useOpencodeModels } from "@/hooks/use-ai-configs";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiConfig, AiProviderInfo } from "@/types/session";

type FormState = {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  provider: "gemini",
  apiKey: "",
  model: "",
  baseUrl: "",
};

function ProviderPanel({
  provider,
  expanded,
  form,
  editing,
  models,
  onToggle,
  onChange,
  onSave,
  saving,
}: {
  provider: AiProviderInfo;
  expanded: boolean;
  form: FormState;
  editing: boolean;
  models: ReturnType<typeof useOpencodeModels>;
  onToggle: () => void;
  onChange: (field: keyof FormState, value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isOpenCode = provider.id === "opencode";
  const availableModels = (models.data?.models ?? []).filter(
    (model) => model.enabled !== false
  );

  return (
    <section className="overflow-hidden rounded-xl border border-dark-400">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-dark-300/30"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1">
          <span className="block text-sm font-medium">{provider.name}</span>
          <span className="block text-xs text-gray-500">
            {isOpenCode ? "Modelos gestionados por el administrador" : "Configuración propia del atleta"}
          </span>
        </span>
        {form.provider === provider.id && form.model && (
          <Check className="h-4 w-4 text-accent-light" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-dark-400 bg-dark-300/15 p-4">
          <label className="block text-xs text-gray-400">
            Nombre de esta configuración
            <input
              className="input mt-1 w-full"
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder={`Mi configuración de ${provider.name}`}
            />
          </label>

          {isOpenCode ? (
            <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-xs text-gray-400">
              <div className="flex items-center gap-2 font-medium text-accent-light">
                <Server className="h-4 w-4" />
                OpenCode Zen / Go
              </div>
              <p className="mt-1">
                No tienes que introducir credenciales. El administrador ya ha conectado OpenCode
                y solo ofrece los modelos con precio configurado.
              </p>
              {models.data?.error && (
                <p className="mt-2 text-red-400">
                  No se pudieron cargar los modelos: {models.data.error}
                </p>
              )}
            </div>
          ) : (
            <label className="block text-xs text-gray-400">
              API key propia
              <input
                type="password"
                className="input mt-1 w-full"
                value={form.apiKey}
                onChange={(event) => onChange("apiKey", event.target.value)}
                placeholder={editing ? "Vacío para conservar la actual" : "Pega tu API key"}
                autoComplete="new-password"
              />
            </label>
          )}

          <label className="block text-xs text-gray-400">
            Modelo
            {isOpenCode ? (
              <select
                className="input mt-1 w-full"
                value={form.model}
                onChange={(event) => onChange("model", event.target.value)}
                disabled={models.isLoading}
              >
                <option value="">
                  {models.isLoading ? "Cargando modelos..." : "Selecciona un modelo"}
                </option>
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} · {model.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input mt-1 w-full"
                value={form.model}
                onChange={(event) => onChange("model", event.target.value)}
                placeholder={provider.defaultModel ?? "Escribe el nombre exacto del modelo"}
              />
            )}
          </label>

          {!isOpenCode && (
            <label className="block text-xs text-gray-400">
              Base URL opcional
              <input
                className="input mt-1 w-full"
                value={form.baseUrl}
                onChange={(event) => onChange("baseUrl", event.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta"
              />
            </label>
          )}

          {isOpenCode && (
            <p className="text-xs text-gray-500">
              El precio lo establece el administrador y se muestra en los registros de consumo.
            </p>
          )}

          <Button onClick={onSave} disabled={saving || !form.model.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editing ? "Guardar cambios" : "Crear configuración"}
          </Button>
        </div>
      )}
    </section>
  );
}

export function AiConfigsManager() {
  const query = useAiConfigs();
  const mutations = useAiConfigsMutations();
  const { toast } = useToast();
  const providers = query.data?.providers ?? [];
  const models = useOpencodeModels({ enabled: providers.some((provider) => provider.id === "opencode") });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>("gemini");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  function reset() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function edit(config: AiConfig) {
    setEditingId(config.id);
    setExpanded(config.provider);
    setForm({
      name: config.name,
      provider: config.provider,
      apiKey: "",
      model: config.model ?? "",
      baseUrl: config.base_url ?? "",
    });
  }

  function change(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function save() {
    const provider = providers.find((item) => item.id === form.provider);
    if (!form.name.trim()) {
      toast({ type: "error", title: "Introduce un nombre para la configuración" });
      return;
    }
    if (!form.model.trim()) {
      toast({ type: "error", title: "Introduce o selecciona un modelo" });
      return;
    }
    if (provider?.needsApiKey && !form.apiKey && !editingId) {
      toast({ type: "error", title: "Introduce tu API key de Gemini" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey,
      model: form.model,
      baseUrl: form.baseUrl || null,
    };
    const options = {
      onSuccess: () => {
        toast({ type: "success", title: editingId ? "Configuración actualizada" : "Configuración creada" });
        reset();
      },
      onError: (error: Error) =>
        toast({ type: "error", title: "No se pudo guardar", description: error.message }),
    };

    if (editingId) {
      mutations.update.mutate({ id: editingId, payload }, options);
    } else {
      mutations.create.mutate(payload, options);
    }
  }

  function test(config: AiConfig) {
    setTestingId(config.id);
    mutations.test.mutate(config.id, {
      onSettled: () => setTestingId(null),
      onSuccess: () => toast({ type: "success", title: "Conexión correcta" }),
      onError: (error: Error) =>
        toast({ type: "error", title: "Error de conexión", description: error.message }),
    });
  }

  if (query.isLoading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Cambiar modelo
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Crea configuraciones independientes. Gemini usa tu propia API key; OpenCode está
            preparado por el administrador.
          </p>
        </div>

        {providers.map((provider) => (
          <ProviderPanel
            key={provider.id}
            provider={provider}
            expanded={expanded === provider.id}
            form={form.provider === provider.id ? form : { ...form, provider: provider.id, model: "", apiKey: "", baseUrl: "" }}
            editing={!!editingId}
            models={models}
            onToggle={() => {
              setExpanded(expanded === provider.id ? null : provider.id);
              setForm((current) => ({
                ...current,
                provider: provider.id,
                model: current.provider === provider.id ? current.model : "",
                apiKey: current.provider === provider.id ? current.apiKey : "",
                baseUrl: current.provider === provider.id ? current.baseUrl : "",
              }));
            }}
            onChange={(field, value) => {
              setExpanded(provider.id);
              setForm((current) => ({ ...current, provider: provider.id, [field]: value }));
            }}
            onSave={save}
            saving={mutations.create.isPending || mutations.update.isPending}
          />
        ))}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">
          Mis configuraciones
        </h2>

        <div className="space-y-2">
          {(query.data?.items ?? []).map((config) => (
            <div
              key={config.id}
              className={`rounded-xl border p-3 ${config.is_default ? "border-accent/50 bg-accent/5" : "border-dark-400 bg-dark-300/30"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Star className={`h-4 w-4 ${config.is_default ? "fill-accent-light text-accent-light" : "text-gray-600"}`} />
                <span className="text-sm font-medium">{config.name}</span>
                <span className="text-xs text-gray-500">
                  {config.provider} · {config.model}
                </span>

                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => test(config)} disabled={!!testingId}>
                    {testingId === config.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                    Probar
                  </Button>
                  <Button variant="ghost" className="px-2 text-xs" onClick={() => edit(config)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  {!config.is_default && (
                    <Button variant="ghost" className="px-2 text-xs text-accent-light" onClick={() => mutations.setDefault.mutate(config.id)}>
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!config.is_default && (
                    <Button variant="ghost" className="px-2 text-xs text-red-400" onClick={() => window.confirm("¿Eliminar esta configuración?") && mutations.remove.mutate(config.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
