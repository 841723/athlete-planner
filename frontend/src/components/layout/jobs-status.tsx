import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { useCancelJob, useJobs } from "@/hooks/use-jobs";
import { useToast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateMany } from "@/lib/invalidate";

function label(type: string) {
  if (type === "sync") return "Sincronizando actividades...";
  if (type === "plan_generation") return "Generando plan...";
  if (type === "plan_chat") return "El entrenador está preparando una respuesta...";
  return "Procesando tarea...";
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
        invalidateMany(queryClient, ["sessions", "weekly", "stats", "charts", "planned", "plans", "plan-detail"]);
      }
      previous.current.set(job.id, job.status);
    }
  }, [data, queryClient, toast]);

  if (active.length === 0) return null;

  return (
    <div className="border-b border-dark-400 bg-dark-200/90 px-4 py-2 text-xs text-gray-300">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        {active.map((job) => (
          <div key={job.id} className="flex items-center gap-2 rounded-lg bg-dark-300/60 px-2.5 py-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-light" />
            <span>{label(job.type)}</span>
            <button
              type="button"
              className="rounded p-0.5 text-gray-500 hover:text-red-300"
              onClick={() => cancel.mutate(job.id)}
              title="Cancelar tarea"
              aria-label="Cancelar tarea"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
