import { useState } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  Sparkles,
  CalendarRange,
  CheckCircle2,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { format } from "@/lib/date-format";
import { usePlanned, useDeletePlanned } from "@/hooks/use-planned";
import { usePlans } from "@/hooks/use-plans";
import { useDeletePlanChat } from "@/hooks/use-plan-chat";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { GeneratePlanModal } from "@/components/planned/generate-plan-modal";
import { PlanChat } from "@/components/planned/plan-chat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { WorkoutText } from "@/components/session/workout-text";
import { getSportColor, getSportLabel, formatDistance } from "@/lib/utils";
import type { PlannedSessionView, Plan } from "@/types/session";

export function PlannedPage() {
  const { data: planned, isLoading } = usePlanned();
  const { data: plans } = usePlans();
  const deleteMutation = useDeletePlanned();
  const deletePlanMutation = useDeletePlanChat();
  const perms = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedSessionView | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const planGroups: { plan: Plan | null; sessions: PlannedSessionView[] }[] = [];
  for (const plan of plans ?? []) {
    const group = sessions.filter((s) => s.plan_id === plan.id);
    if (group.length > 0) planGroups.push({ plan, sessions: group });
  }
  const manual = sessions.filter((s) => !s.plan_id);
  if (manual.length > 0) planGroups.push({ plan: null, sessions: manual });

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Planificadas</h1>
          <p className="text-sm text-gray-500 mt-1">{sessions.length} entrenamientos planificados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* TEMPORAL: botón de generar plan oculto */}
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
        <div className="space-y-8">
          {planGroups.map((group) => {
            const done = group.sessions.filter((s) => s.merged_with).length;
            const groupKey = group.plan?.id ?? "manual";
            const isCollapsed = !!collapsed[groupKey];
            const plan = group.plan;
            const hasChat = !!plan;
            return (
              <section key={groupKey} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-dark-300/60 text-gray-300 text-sm"
                    onClick={() => setCollapsed((c) => ({ ...c, [groupKey]: !isCollapsed }))}
                    title={isCollapsed ? "Expandir" : "Comprimir"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {group.plan ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-accent/15 text-accent-light text-xs font-semibold">
                        <CalendarRange className="w-3.5 h-3.5" />
                        Plan del {format(parseISO(group.plan.createdAt), "d MMM yyyy")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-dark-400/50 text-gray-300 text-xs font-semibold">
                        <User className="w-3.5 h-3.5" />
                        Manual
                      </span>
                    )}
                  </button>
                  {group.plan?.promptName && (
                    <span className="px-1.5 py-0.5 rounded bg-dark-400/50 text-gray-400 text-[10px]">
                      {group.plan.promptName}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {group.sessions.length} sesiones
                    {done > 0 && <span className="text-green-400"> · {done} realizadas</span>}
                  </span>
                  {plan && perms.canEdit && (
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300 ml-auto"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Esto elimina el plan completo: todas sus sesiones planificadas y el chat con la IA. ¿Continuar?"
                          )
                        ) {
                          deletePlanMutation.mutate({ planId: plan.id });
                        }
                      }}
                      disabled={deletePlanMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar plan
                    </Button>
                  )}
                </div>
                {group.plan?.comments && (
                  <p className="text-xs text-gray-400 mb-4 italic">{group.plan.comments}</p>
                )}
                {!isCollapsed && (
                  <div className={hasChat ? "grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start" : ""}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.sessions.map((s) => {
                        const merged = !!s.merged_with;
                        return (
                          <div key={s.id} className={`card p-5 flex flex-col ${merged ? "opacity-75" : ""}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getSportColor(s.category) }}
                              />
                              <span className="text-sm font-semibold truncate">{s.title ?? s.name}</span>
                              {merged ? (
                                <span className="badge badge-completed ml-auto">Realizada</span>
                              ) : (
                                <span className="badge badge-planned ml-auto">Plan</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mb-3">
                              {getSportLabel(s.category)} · {format(parseISO(s.start_date_local), "d MMM yyyy")} ·{" "}
                              {format(parseISO(s.start_date_local), "HH:mm")}
                            </div>
                            {s.workout_text ? (
                              <div className="mt-2 flex-1">
                                <WorkoutText text={s.workout_text} />
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
                            {merged && s.merged_with ? (
                              <div className="mt-3 text-xs">
                                <Link
                                  to={`/session/${s.merged_with}`}
                                  className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ver sesión realizada
                                </Link>
                              </div>
                            ) : null}
                            {perms.canEdit && !merged && (
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
                        );
                      })}
                    </div>
                    {hasChat && (
                      <div className="lg:sticky lg:top-4">
                        <PlanChat plan={plan} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
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
