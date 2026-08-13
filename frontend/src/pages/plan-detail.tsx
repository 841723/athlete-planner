import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronsDownUp, ChevronsUpDown, ExternalLink, MessageCircle, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { tenantPath } from "@/lib/tenant";
import { useAuth } from "@/components/auth/auth-context";
import { usePlanDetail } from "@/hooks/use-plan-detail";
import { useDeletePlanned } from "@/hooks/use-planned";
import { usePermissions } from "@/hooks/use-permissions";
import { PlanChat } from "@/components/planned/plan-chat";
import { PlanContextPanel } from "@/components/planned/plan-context-panel";
import { SessionTextModal } from "@/components/planned/session-text-modal";
import { WorkoutText } from "@/components/session/workout-text";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrainingDay, getSportColor, getSportLabel } from "@/lib/utils";
import type { PlannedSessionView } from "@/types/session";

export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const { activeTenantId } = useAuth();
  const query = usePlanDetail(planId);
  const permissions = usePermissions();
  const deleteMutation = useDeletePlanned();
  const [editingSession, setEditingSession] = useState<PlannedSessionView | null>(null);

  const sessions = query.data?.plannedSessions ?? [];
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedSessions(new Set(sessions.map((session) => session.id)));
  }, [query.data?.id, sessions.length]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  const plan = query.data;

  if (!plan) {
    return (
      <div className="card p-10 text-center">
        <p className="text-gray-400">No se pudo cargar este plan.</p>
        <Link to={tenantPath(activeTenantId, "/trainer")} className="btn btn-primary mt-4 inline-flex">
          Volver al entrenador
        </Link>
      </div>
    );
  }

  const disciplineOrder = ["swimming", "cycling", "running", "strength", "hiking", "walking", "other"];
  const orderedSessions = [...sessions].sort((a, b) => {
    const discipline = disciplineOrder.indexOf(a.category) - disciplineOrder.indexOf(b.category);
    return discipline || a.start_date_local.localeCompare(b.start_date_local);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <Link
        to={tenantPath(activeTenantId, "/trainer")}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Entrenador
      </Link>

      <header className="card bg-gradient-to-br from-accent/10 via-dark-200 to-dark-200 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
              <Sparkles className="h-4 w-4" />
              Entrenador
            </div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Tu entrenador personal
            </h1>
            <p className="mt-2 text-sm text-gray-400">Recomendaciones que evolucionan con tu entrenamiento.</p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(15rem,18rem)]">
      <section className="card p-5 lg:col-start-1 lg:row-start-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Entrenamientos</h2>
            <p className="mt-1 text-xs text-gray-500">
              Las sesiones que pertenecen a este plan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{sessions.length} sesiones</span>
            <button type="button" className="rounded-lg p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-200" onClick={() => setExpandedSessions(new Set(sessions.map((session) => session.id)))} title="Extender todo" aria-label="Extender todo"><ChevronsUpDown className="h-4 w-4" /></button>
            <button type="button" className="rounded-lg p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-200" onClick={() => setExpandedSessions(new Set())} title="Colapsar todo" aria-label="Colapsar todo"><ChevronsDownUp className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {orderedSessions.map((session, index) => (
            <Fragment key={session.id}>
            {(index === 0 || orderedSessions[index - 1].category !== session.category) && <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-accent-light">{getSportLabel(session.category)}</h3>}
            <details open={expandedSessions.has(session.id)} onToggle={(event) => {
              const next = new Set(expandedSessions);
              if (event.currentTarget.open) next.add(session.id); else next.delete(session.id);
              setExpandedSessions(next);
            }} className="rounded-xl border border-dark-400 bg-dark-300/30 p-4">
              <summary className="cursor-pointer list-none">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: getSportColor(session.category) }} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{session.title ?? session.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                     {getSportLabel(session.category)} · {formatTrainingDay(session.start_date_local, session.weekNumber)}
                  </p>
                </div>
                {session.merged_with && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
                {permissions.canEdit && (
                  <button
                    onClick={() => setEditingSession(session)}
                    title="Editar el texto del entrenamiento"
                    aria-label={`Editar el texto de ${session.title ?? session.name}`}
                    className="shrink-0 rounded-lg text-gray-500 transition-colors hover:bg-dark-300 hover:text-gray-200"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {permissions.canEdit && (
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${session.title ?? session.name}" de este plan?`)) {
                        deleteMutation.mutate(session.id);
                      }
                    }}
                    title="Eliminar sesión del plan"
                    aria-label={`Eliminar ${session.title ?? session.name}`}
                    className="shrink-0 rounded-lg text-gray-500 transition-colors hover:bg-dark-300 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              </summary>

              {session.completed_session && (
                <Link
                  to={tenantPath(activeTenantId, `/session/${session.completed_session.id}`)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-green-400 hover:text-green-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver actividad realizada
                </Link>
              )}

              <div className="mt-3">
                {session.workout_text ? (
                  <WorkoutText text={session.workout_text} />
                ) : (
                  <div className="space-y-1">
                    {(session.objectives ?? []).map((objective, index) => (
                      <p key={index} className="text-sm text-gray-300">
                        {objective.label && <span className="mr-2 text-[10px] uppercase text-accent-light">{objective.label}</span>}
                        {objective.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </details>
            </Fragment>
          ))}
        </div>
      </section>

      <section className="min-w-0 lg:col-start-2 lg:row-start-1">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-light">
          <MessageCircle className="h-4 w-4" />
          Conversación
        </div>
        <PlanChat plan={plan} />
      </section>

      <div className="lg:col-start-3 lg:row-start-1">
        <PlanContextPanel plan={plan} />
      </div>
      </div>

      {editingSession && (
        <SessionTextModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
}
