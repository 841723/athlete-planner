import { useState } from "react";
import {
  CalendarRange,
  ChevronRight,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { formatTrainingDay } from "@/lib/utils";
import { tenantPath } from "@/lib/tenant";
import { useAuth } from "@/components/auth/auth-context";
import { usePlanned, useDeletePlanned } from "@/hooks/use-planned";
import { usePlans } from "@/hooks/use-plans";
import { useRetryPlan } from "@/hooks/use-generate-plan";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { GeneratePlanModal } from "@/components/planned/generate-plan-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import type { Plan, PlannedSessionView } from "@/types/session";

function statusLabel(plan: Plan) {
  if (plan.status === "failed") return "Error";
  if (plan.status === "generating") return "Generando";
  if (plan.status === "pending") return "Pendiente";
  if (plan.trainingCompleted) return "Completado";
  return "Activo";
}

function statusClass(plan: Plan) {
  if (plan.status === "failed") return "bg-red-500/15 text-red-400";
  if (plan.status === "completed" && plan.trainingCompleted) return "badge-completed";
  return "bg-amber-500/15 text-amber-400";
}

function PlanCard({
  plan,
  sessions,
  activeTenantId,
  canEdit,
  onRetry,
}: {
  plan: Plan;
  sessions: PlannedSessionView[];
  activeTenantId: string | null;
  canEdit: boolean;
  onRetry: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const orderedSessions = [...sessions].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));

  const range = orderedSessions.length > 0
    ? `${formatTrainingDay(orderedSessions[0].start_date_local, orderedSessions[0].weekNumber)} - ${formatTrainingDay(orderedSessions[orderedSessions.length - 1].start_date_local, orderedSessions[orderedSessions.length - 1].weekNumber)}`
    : `${plan.weeks} semanas`;

  return (
    <Link
      to={tenantPath(activeTenantId, `/trainer/${plan.id}`)}
      className="card group flex items-center gap-4 p-5 transition-colors hover:border-accent/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
        <CalendarRange className="h-5 w-5 text-accent-light" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Plan de entrenamiento</h2>
          <span className={`badge ${statusClass(plan)}`}>{statusLabel(plan)}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {range} · {sessions.length} entrenamientos · {plan.completedSessions ?? 0}/{sessions.length} realizados
        </p>

        {plan.status === "failed" && (
          <p className="mt-2 text-xs text-red-400">{plan.error ?? "La generación falló."}</p>
        )}
      </div>

      {plan.status === "failed" && canEdit ? (
        <Button
          variant="ghost"
          className="text-xs"
          onClick={(event) => {
            event.preventDefault();
            onRetry(event);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      ) : (
        <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-accent-light" />
      )}
    </Link>
  );
}

function ManualSessions({ sessions, canEdit }: { sessions: PlannedSessionView[]; canEdit: boolean }) {
  const deleteMutation = useDeletePlanned();

  return (
    <section className="card mt-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-gray-400" />
        <div>
          <h2 className="font-semibold">Sesiones manuales</h2>
          <p className="text-xs text-gray-500">No pertenecen a un plan generado.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sessions.slice(0, 8).map((session) => (
          <div key={session.id} className="flex items-center gap-2 rounded-lg bg-dark-300/40 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{session.title ?? session.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatTrainingDay(session.start_date_local, session.weekNumber)}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  if (window.confirm(`¿Eliminar "${session.title ?? session.name}"?`)) {
                    deleteMutation.mutate(session.id);
                  }
                }}
                title="Eliminar sesión"
                aria-label={`Eliminar ${session.title ?? session.name}`}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-dark-300 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlannedPage() {
  const { data: sessions, isLoading } = usePlanned();
  const { data: plans } = usePlans();
  const permissions = usePermissions();
  const { activeTenantId } = useAuth();
  const retryPlan = useRetryPlan();

  const [formOpen, setFormOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const plannedSessions = sessions ?? [];
  const generatedPlans = plans ?? [];
  const manualSessions = plannedSessions.filter((session) => !session.plan_id);
  const isGenerating = generatedPlans.some(
    (plan) => plan.status === "pending" || plan.status === "generating"
  );

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entrenador</h1>
          <p className="mt-1 text-sm text-gray-500">Tu planificación continua y conversación con el entrenador.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {permissions.canGeneratePlan && (
            <Button variant="outline" disabled={isGenerating} onClick={() => setGenerateOpen(true)}>
              <Sparkles className="h-4 w-4" /> Generar con IA
            </Button>
          )}
          {permissions.canEdit && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva sesión
            </Button>
          )}
        </div>
      </header>

      {generatedPlans.length === 0 && manualSessions.length === 0 ? (
        <div className="card p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="font-medium text-gray-300">Todavía no hay una hoja de ruta</p>
          <p className="mt-1 text-sm text-gray-500">Genera un plan con IA o añade una sesión manual.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generatedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              sessions={plannedSessions.filter((session) => session.plan_id === plan.id)}
              activeTenantId={activeTenantId}
              canEdit={permissions.canEdit}
              onRetry={() => retryPlan.mutate(plan.id)}
            />
          ))}

          {manualSessions.length > 0 && (
            <ManualSessions sessions={manualSessions} canEdit={permissions.canEdit} />
          )}
        </div>
      )}

      <PlannedFormModal
        open={formOpen}
        session={null}
        defaultDate={new Date().toISOString().slice(0, 10)}
        onClose={() => setFormOpen(false)}
      />
      <GeneratePlanModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  );
}

export function TrainerPage() {
  const { data: plans, isLoading } = usePlans();
  const { activeTenantId } = useAuth();
  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-5xl rounded-2xl" />;
  const plan = plans?.[0];
  if (!plan) {
    return <PlannedPage />;
  }
  return <Navigate to={tenantPath(activeTenantId, `/trainer/${plan.id}`)} replace />;
}
