import { useState } from "react";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { usePlanned, useDeletePlanned } from "@/hooks/use-planned";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { GeneratePlanModal } from "@/components/planned/generate-plan-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { getSportColor, getSportLabel, formatDistance } from "@/lib/utils";
import type { PlannedSessionView } from "@/types/session";

export function PlannedPage() {
  const { data: planned, isLoading } = usePlanned();
  const deleteMutation = useDeletePlanned();
  const perms = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedSessionView | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const sessions = planned ?? [];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Planificadas</h1>
          <p className="text-sm text-gray-500 mt-1">{sessions.length} entrenamientos planificados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perms.canGeneratePlan && (
            <Button variant="outline" onClick={() => setGenerateOpen(true)}>
              <Sparkles className="w-4 h-4" /> Generar Plan con IA
            </Button>
          )}
          {perms.canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Nueva planificada
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No hay entrenamientos planificados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="card p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getSportColor(s.category) }}
                />
                <span className="text-sm font-semibold truncate">{s.title ?? s.name}</span>
                <span className="badge badge-planned ml-auto">Plan</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">
                {getSportLabel(s.category)} · {format(parseISO(s.start_date_local), "d MMM yyyy")} ·{" "}
                {format(parseISO(s.start_date_local), "HH:mm")}
              </div>
              {(s.objectives ?? []).length > 0 && (
                <div className="mt-1 space-y-1.5 flex-1">
                  {(s.objectives ?? []).map((obj, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      {obj.label && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">
                          {obj.label}
                        </span>
                      )}
                      <span className="text-gray-300">{obj.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {s.distance_m ? (
                <div className="mt-3 text-xs text-gray-400">{formatDistance(s.distance_m)}</div>
              ) : null}
              {perms.canEdit && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-dark-400">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${s.title ?? s.name}"?`)) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PlannedFormModal
        open={formOpen}
        session={editing}
        defaultDate={new Date().toISOString().slice(0, 10)}
        onClose={() => setFormOpen(false)}
      />

      <GeneratePlanModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  );
}
