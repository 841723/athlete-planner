import { useEffect, useRef } from "react";
import { Loader2, X, Zap } from "lucide-react";
import { useCancelJob, useJobs } from "@/hooks/use-jobs";
import { useToast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateMany } from "@/lib/invalidate";

function label(type: string) {
  if (type === "sync") return "Sincronizando actividades...";
  if (type === "coach_chat") return "El entrenador está preparando una respuesta...";
  return "Procesando tarea...";
}

function progressLabel(progress: Record<string, unknown> | null | undefined) {
  if (!progress) return null;
  const percent = Number(progress.percent ?? progress.progress);
  return Number.isFinite(percent) && percent >= 0 ? `${Math.min(100, Math.round(percent))}%` : null;
}

export function JobsStatus() {
  const { data = [] } = useJobs(false);
  const cancel = useCancelJob();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previous = useRef(new Map<string, string>());
  const active = data.filter((job) => job.status === "pending" || job.status === "running");

  useEffect(() => {
    for (const job of data) {
      const old = previous.current.get(job.id);
      if (old && old !== job.status && ["completed", "failed", "cancelled"].includes(job.status)) {
        const title = job.status === "completed" ? "Tarea completada" : job.status === "cancelled" ? "Tarea cancelada" : "Error en la tarea";
        toast({ type: job.status === "completed" ? "success" : "error", title, description: job.error ?? undefined });
        invalidateMany(queryClient, ["sessions", "weekly", "stats", "charts", "planned"]);
      }
      previous.current.set(job.id, job.status);
    }
  }, [data, queryClient, toast]);

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 right-4 z-50 md:right-auto md:w-[min(27rem,calc(100vw-2rem))]" aria-live="polite">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-accent/25 bg-dark-200/95 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-dark-400 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent-light">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">Actividad en curso</p>
              <p className="text-[10px] text-gray-500">Los cambios se actualizan en tiempo real</p>
            </div>
          </div>
          <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent-light">{active.length}</span>
        </div>
        <div className="space-y-1.5 p-2">
          {active.map((job) => {
            const progress = progressLabel(job.progress);
            return (
              <div key={job.id} className="flex items-center gap-3 rounded-xl bg-dark-300/60 px-3 py-2.5">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-light" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-gray-200">{label(job.type)}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-600">
                    <span>{job.status === "running" ? "En curso" : "En cola"}</span>
                    {progress && <span className="text-accent-light">{progress}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-400/10 hover:text-red-300"
                  onClick={() => cancel.mutate(job.id)}
                  title="Cancelar tarea"
                  aria-label="Cancelar tarea"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
