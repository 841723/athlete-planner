import { useState } from "react";
import { Sparkles, Loader2, X, Save } from "lucide-react";
import { useGeneratePlan } from "@/hooks/use-generate-plan";
import { useProfileHistory } from "@/hooks/use-profile-history";
import { usePrompts, useSavePrompt } from "@/hooks/use-prompts";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { Button } from "@/components/ui/button";

interface GeneratePlanModalProps {
  open: boolean;
  onClose: () => void;
}

export function GeneratePlanModal({ open, onClose }: GeneratePlanModalProps) {
  const generateMutation = useGeneratePlan();
  const profileHistoryQuery = useProfileHistory();
  const promptsQuery = usePrompts();
  const savePromptMutation = useSavePrompt();
  const aiSettingsQuery = useAiSettings();

  const [comments, setComments] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [savePromptName, setSavePromptName] = useState("");
  const [result, setResult] = useState<{
    comments: string;
    sessionCount: number;
    profileUpdated: boolean;
  } | null>(null);

  if (!open) return null;

  const hasAiConfig = !!aiSettingsQuery.data?.provider;
  const customPrompts = promptsQuery.data?.filter((p) => !p.is_predefined) ?? [];
  const canSavePrompt = customPrompts.length < 5;

  function handleGenerate() {
    if (!hasAiConfig) {
      window.alert("Configura un proveedor de IA en Configuración antes de generar un plan.");
      return;
    }
    setResult(null);
    generateMutation.mutate(
      {
        comments,
        weeks,
        profileVersionId: selectedProfileId || undefined,
        promptId: selectedPromptId || undefined,
      },
      {
        onSuccess: (data) => {
          setResult({
            comments: data.comments,
            sessionCount: data.sessions.length,
            profileUpdated: data.profileUpdated ?? false,
          });
        },
      }
    );
  }

  function handleSavePrompt() {
    if (!savePromptName.trim()) return;
    const prompt = promptsQuery.data?.find((p) => p.id === selectedPromptId);
    if (!prompt) return;
    savePromptMutation.mutate(
      { name: savePromptName, content: prompt.content },
      { onSuccess: () => setSavePromptName("") }
    );
  }

  function handleClose() {
    setComments("");
    setWeeks(1);
    setSelectedProfileId("");
    setSelectedPromptId("");
    setSavePromptName("");
    setResult(null);
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

        {!hasAiConfig && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
            <p className="text-sm text-amber-400">
              Configura un proveedor de IA en{" "}
              <a href="/config" className="underline font-semibold">Configuración</a>{" "}
              antes de generar un plan.
            </p>
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <h4 className="text-sm font-semibold text-accent mb-2">Comentarios del entrenador</h4>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{result.comments}</p>
            </div>
            <div className="p-3 rounded-lg bg-dark-300/50">
              <p className="text-sm text-gray-400">
                Se crearon <span className="font-semibold text-white">{result.sessionCount}</span> sesiones
                planificadas.
              </p>
              {result.profileUpdated && (
                <p className="text-xs text-blue-400 mt-1">
                  El perfil del atleta fue actualizado por la IA.
                </p>
              )}
            </div>
            <div className="flex justify-end pt-3 border-t border-dark-400">
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {profileHistoryQuery.data && profileHistoryQuery.data.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">
                  Perfil del atleta a usar
                </label>
                <select
                  className={field}
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                >
                  <option value="">Perfil actual (activo)</option>
                  {profileHistoryQuery.data.map((v) => (
                    <option key={v.id} value={v.id}>
                      {new Date(v.created_at).toLocaleDateString("es-ES")} - {v.author === "ai" ? "Generado por IA" : "Editado manualmente"}
                    </option>
                  ))}
                </select>
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
                {selectedPromptId && canSavePrompt && (
                  <div className="flex gap-2 mt-2">
                    <input
                      className={field}
                      value={savePromptName}
                      onChange={(e) => setSavePromptName(e.target.value)}
                      placeholder="Nombre para copiar como personalizado"
                    />
                    <Button
                      variant="ghost"
                      className="text-xs whitespace-nowrap"
                      onClick={handleSavePrompt}
                      disabled={!savePromptName.trim() || savePromptMutation.isPending}
                    >
                      <Save className="w-3.5 h-3.5" /> Copiar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                Comentarios sobre tus últimas sesiones
              </label>
              <textarea
                className={field}
                rows={4}
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
              Se eliminarán las sesiones planificadas existentes y se crearán nuevas.
            </div>

            {generateMutation.isError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{generateMutation.error.message}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-dark-400">
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending || !hasAiConfig}>
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
