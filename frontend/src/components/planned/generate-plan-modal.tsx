import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useGeneratePlan } from "@/hooks/use-generate-plan";
import { Button } from "@/components/ui/button";

interface GeneratePlanModalProps {
  open: boolean;
  onClose: () => void;
}

export function GeneratePlanModal({ open, onClose }: GeneratePlanModalProps) {
  const generateMutation = useGeneratePlan();
  const [comments, setComments] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [result, setResult] = useState<{ comments: string; sessionCount: number } | null>(null);

  if (!open) return null;

  function handleGenerate() {
    setResult(null);
    generateMutation.mutate(
      { comments, weeks },
      {
        onSuccess: (data) => {
          setResult({
            comments: data.comments,
            sessionCount: data.sessions.length,
          });
        },
      }
    );
  }

  function handleClose() {
    setComments("");
    setWeeks(1);
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
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

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
            </div>
            <div className="flex justify-end pt-3 border-t border-dark-400">
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
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
