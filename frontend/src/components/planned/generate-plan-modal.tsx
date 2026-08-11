import { useState } from "react";
import { Sparkles, X, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { useGeneratePlan } from "@/hooks/use-generate-plan";
import { usePrompts } from "@/hooks/use-prompts";
import { useAiConfigs } from "@/hooks/use-ai-configs";
import { useEquipment } from "@/hooks/use-equipment";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface GeneratePlanModalProps {
  open: boolean;
  onClose: () => void;
}

export function GeneratePlanModal({ open, onClose }: GeneratePlanModalProps) {
  const generateMutation = useGeneratePlan();
  const promptsQuery = usePrompts();
  const aiConfigsQuery = useAiConfigs();
  const equipmentQuery = useEquipment();

  const [comments, setComments] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [promptPreview, setPromptPreview] = useState(false);

  if (!open) return null;

  const configs = aiConfigsQuery.data?.items ?? [];
  const configsLoading = aiConfigsQuery.isLoading;
  const selectedConfig = configs.find((c) => c.id === selectedConfigId);
  const hasAiConfig = configs.length > 0;
  const selectedPrompt = promptsQuery.data?.find((p) => p.id === selectedPromptId);
  const equipmentItems = equipmentQuery.data?.items ?? [];

  function handleGenerate() {
    if (!hasAiConfig) {
      window.alert("Configura un proveedor de IA en Configuración antes de generar un plan.");
      return;
    }
    generateMutation.mutate(
      {
        comments,
        weeks,
        aiConfigId: selectedConfigId || undefined,
        promptId: selectedPromptId || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  }

  function handleClose() {
    setComments("");
    setWeeks(1);
    setSelectedConfigId("");
    setSelectedPromptId("");
    setPromptPreview(false);
    generateMutation.reset();
    onClose();
  }

  const field =
    "w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60 resize-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleClose}>
      <div
        className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold">Generar Plan con IA</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasAiConfig && !configsLoading && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
            <p className="text-sm text-amber-400">
              Configura un proveedor de IA en{" "}
              <a href="/config" className="underline font-semibold">Configuración</a>{" "}
              antes de generar un plan.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Configuración de IA</label>
            {configsLoading ? (
              <Skeleton className="h-10 rounded-lg" />
            ) : (
              <select
                className={field}
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
              >
                <option value="">Configuración predeterminada</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_default ? "(por defecto)" : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedConfig && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedConfig.provider}
                {selectedConfig.model ? ` · ${selectedConfig.model}` : ""}
              </p>
            )}
          </div>

          {equipmentQuery.data && equipmentItems.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1">
                <Dumbbell className="w-3 h-3" /> Equipamiento disponible
              </label>
              <div className="rounded-lg bg-dark-300/50 border border-dark-400 p-2.5 flex flex-wrap gap-1.5">
                {equipmentItems.map((it) => (
                  <span
                    key={it.item}
                    className="text-xs px-2.5 py-1 rounded-full bg-dark-400/40 border border-dark-400 text-gray-300"
                  >
                    {it.item}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tu perfil marca este material como disponible y el entrenador IA lo tendrá en cuenta en el plan.
                Puedes cambiarlo en Configuración → Equipamiento.
              </p>
            </div>
          )}

          {promptsQuery.data && promptsQuery.data.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                Prompt de entrenador
              </label>
              <select
                className={field}
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
              >
                <option value="">Prompt por defecto</option>
                {promptsQuery.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.is_predefined ? "📋 " : "✏️ "}{p.name}
                  </option>
                ))}
              </select>
              {selectedPrompt && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPromptPreview((v) => !v)}
                    className="text-xs text-accent-light inline-flex items-center gap-1"
                  >
                    {promptPreview ? (
                      <><ChevronUp className="w-3 h-3" /> Ocultar preview</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> Ver prompt</>
                    )}
                  </button>
                  {promptPreview && (
                    <pre className="mt-1.5 max-h-40 overflow-y-auto rounded-lg bg-dark-400/40 p-2 text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px]">
                      {selectedPrompt.content}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">
              Comentarios sobre tus últimas sesiones
            </label>
            <AutoTextarea
              className={field}
              minRows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ej: Esta semana he entrenado poco por trabajo. Las piernas están cargadas. Hazme el plan de la semana #14..."
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">
              ¿Cuántas semanas quieres planificar?
            </label>
            <select
              className="w-full rounded-lg bg-dark-300/50 border border-dark-400 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              <option value={1}>1 semana</option>
              <option value={2}>2 semanas</option>
              <option value={3}>3 semanas</option>
              <option value={4}>4 semanas</option>
            </select>
          </div>

          <div className="p-3 rounded-lg bg-dark-300/50 text-xs text-gray-500">
            Se eliminarán las sesiones planificadas existentes y se crearán nuevas. La generación ocurre en segundo plano; podrás seguir navegando mientras la IA trabaja.
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-dark-400">
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending || !hasAiConfig}>
              <Sparkles className="w-4 h-4" /> Generar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
