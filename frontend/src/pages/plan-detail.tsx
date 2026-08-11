import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ExternalLink, MessageCircle, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { tenantPath } from "@/lib/tenant";
import { useAuth } from "@/components/auth/auth-context";
import { usePlanDetail } from "@/hooks/use-plan-detail";
import { PlanChat } from "@/components/planned/plan-chat";
import { WorkoutText } from "@/components/session/workout-text";
import { Markdown } from "@/components/ui/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrainingDay, getSportColor, getSportLabel } from "@/lib/utils";

export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const { activeTenantId } = useAuth();
  const query = usePlanDetail(planId);

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
        <Link to={tenantPath(activeTenantId, "/planned")} className="btn btn-primary mt-4 inline-flex">
          Volver a planificadas
        </Link>
      </div>
    );
  }

  const sessions = plan.plannedSessions ?? [];
  const orderedSessions = [...sessions].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      <Link
        to={tenantPath(activeTenantId, "/planned")}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Planificadas
      </Link>

      <header className="card bg-gradient-to-br from-accent/10 via-dark-200 to-dark-200 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
              <Sparkles className="h-4 w-4" />
              Plan de entrenamiento
            </div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Plan de entrenamiento
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                  {orderedSessions.length > 0
                   ? `${formatTrainingDay(orderedSessions[0].start_date_local, orderedSessions[0].weekNumber)} - ${formatTrainingDay(orderedSessions[orderedSessions.length - 1].start_date_local, orderedSessions[orderedSessions.length - 1].weekNumber)}`
                  : `${plan.weeks} semanas`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {plan.completedSessions ?? 0}/{sessions.length} realizados
              </span>
            </div>
          </div>

          <span className={`badge ${plan.status === "failed" ? "bg-red-500/15 text-red-400" : plan.trainingCompleted ? "badge-completed" : "bg-amber-500/15 text-amber-400"}`}>
            {plan.status === "failed"
              ? "Error"
              : plan.status === "generating"
              ? "Generando"
              : plan.status === "pending"
              ? "Pendiente"
              : plan.trainingCompleted
              ? "Completado"
              : "En curso"}
          </span>
        </div>
      </header>

      {plan.comments && (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-light">
            <Sparkles className="h-4 w-4" />
            Análisis del entrenador
          </div>
          <Markdown text={plan.comments} />
        </section>
      )}

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Entrenamientos</h2>
            <p className="mt-1 text-xs text-gray-500">
              Las sesiones que pertenecen a este plan.
            </p>
          </div>
          <span className="text-xs text-gray-500">{sessions.length} sesiones</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <article key={session.id} className="rounded-xl border border-dark-400 bg-dark-300/30 p-4">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: getSportColor(session.category) }} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{session.title ?? session.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                     {getSportLabel(session.category)} · {formatTrainingDay(session.start_date_local, session.weekNumber)}
                  </p>
                </div>
                {session.merged_with && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              </div>

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
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent-light">
          <MessageCircle className="h-4 w-4" />
          Conversación
        </div>
        <PlanChat plan={plan} />
      </section>
    </div>
  );
}
