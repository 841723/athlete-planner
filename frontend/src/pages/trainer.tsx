import { useState } from "react";
import {
  CircleCheck,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelRightClose,
} from "lucide-react";
import { usePlanned, useDeletePlanned } from "@/hooks/use-planned";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import { useSessionAnalysis } from "@/hooks/use-session-analysis";
import { CoachChat } from "@/components/planned/coach-chat";
import { CoachOptions } from "@/components/planned/coach-options";
import { PlannedFormModal } from "@/components/planned/planned-form";
import { WorkoutText } from "@/components/session/workout-text";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrainerDate, getSportColor, getSportLabel, localDateKey, formatDistance, formatDuration } from "@/lib/utils";
import type { PlannedSessionView, SessionAnalysisItem } from "@/types/session";

export function TrainerPage() {
  const { data: sessions, isLoading, error, refetch } = usePlanned();
  const permissions = usePermissions();
  const deleteMutation = useDeletePlanned();
  const { data: analysis } = useSessionAnalysis();

  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<PlannedSessionView | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [showTrainingPanel, setShowTrainingPanel] = useState(true);
  const [showOptionsPanel, setShowOptionsPanel] = useState(true);

  const orderedSessions = (sessions ?? []).sort((a, b) =>
    a.start_date_local.localeCompare(b.start_date_local)
  );
  const pendingSessions = orderedSessions.filter((session) => !session.merged_with);
  const completedSessions = orderedSessions.filter((session) => session.merged_with);
  const analysesBySession = new Map((analysis?.latest ?? []).map((item) => [item.session_id, item]));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,25rem)_minmax(0,1fr)_minmax(15rem,25rem)]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-300">No se pudieron cargar las sesiones planificadas.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-5 animate-fade-in">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entrenador</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tu planificación continua y conversación con el entrenador.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {permissions.canEdit && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="btn btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Añadir manual
            </button>
          )}
        </div>
      </header>
      <div className="hidden justify-end gap-2 xl:flex">
        <button type="button" className="btn btn-outline inline-flex items-center gap-1.5 text-xs" onClick={() => setShowTrainingPanel((value) => !value)}>
          <PanelLeftClose className="h-3.5 w-3.5" />
          {showTrainingPanel ? "Ocultar entrenamientos" : "Mostrar entrenamientos"}
        </button>
        <button type="button" className="btn btn-outline inline-flex items-center gap-1.5 text-xs" onClick={() => setShowOptionsPanel((value) => !value)}>
          <PanelRightClose className="h-3.5 w-3.5" />
          {showOptionsPanel ? "Ocultar configuración" : "Mostrar configuración"}
        </button>
      </div>
      <div className={`grid items-start gap-5 lg:grid-cols-[minmax(15rem,25rem)_minmax(0,1fr)_minmax(15rem,25rem)] ${showTrainingPanel && showOptionsPanel ? "xl:grid-cols-[minmax(15rem,25rem)_minmax(0,1fr)_minmax(15rem,25rem)]" : showTrainingPanel ? "xl:grid-cols-[minmax(15rem,25rem)_minmax(0,1fr)]" : showOptionsPanel ? "xl:grid-cols-[minmax(0,1fr)_minmax(15rem,25rem)]" : "xl:grid-cols-1"}`}>
        {showTrainingPanel && <div className="min-w-0 space-y-5">
          <PlannedSessions
            sessions={pendingSessions}
            heading="Entrenamientos"
            canEdit={permissions.canEdit}
            expandedSessions={expandedSessions}
            setExpandedSessions={setExpandedSessions}
            onEditSession={permissions.canEdit ? setEditingSession : undefined}
            onDeleteSession={
              permissions.canEdit
                ? (id) => {
                    if (window.confirm("¿Eliminar esta sesión planificada?")) {
                      deleteMutation.mutate(id);
                    }
                  }
                : undefined
            }
            analysisBySession={analysesBySession}
          />
          {completedSessions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompleted((value) => !value)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dark-400 bg-dark-300/30 px-3 py-2.5 text-xs text-gray-400 transition-colors hover:border-accent/40 hover:text-gray-200"
            >
              {showCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showCompleted ? "Ocultar entrenamientos realizados" : `Mostrar entrenamientos realizados (${completedSessions.length})`}
            </button>
          )}
          {showCompleted && <PlannedSessions
              sessions={completedSessions}
              heading="Realizadas"
              canEdit={false}
              expandedSessions={expandedSessions}
              setExpandedSessions={setExpandedSessions}
              onEditSession={undefined}
              onDeleteSession={undefined}
              analysisBySession={analysesBySession}
            />}
        </div>
        }

        <div className="min-w-0">
          <CoachChat />
        </div>

        {showOptionsPanel && <div className="min-w-0">
          <CoachOptions />
        </div>}
      </div>

      <PlannedFormModal
        open={formOpen}
        session={null}
        defaultDate={localDateKey()}
        onClose={() => setFormOpen(false)}
      />
      {editingSession && (
        <PlannedFormModal
          open
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
}

interface PlannedSessionsProps {
  sessions: PlannedSessionView[];
  heading: string;
  canEdit: boolean;
  expandedSessions: Set<string>;
  setExpandedSessions: (next: (prev: Set<string>) => Set<string>) => void;
  onEditSession?: (session: PlannedSessionView) => void;
  onDeleteSession?: (id: string) => void;
  analysisBySession?: Map<string, SessionAnalysisItem>;
}

function PlannedSessions({
  sessions,
  heading,
  canEdit,
  expandedSessions,
  setExpandedSessions,
  onEditSession,
  onDeleteSession,
  analysisBySession,
}: PlannedSessionsProps) {
  const { activeTenantId } = useAuth();
  const expandAll = () =>
    setExpandedSessions(() => new Set(sessions.map((s) => s.id)));
  const collapseAll = () => setExpandedSessions(() => new Set());

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent-light" />
          <h2 className="text-lg font-bold">{heading}</h2>
          <span className="text-xs text-gray-500">{sessions.length} sesiones</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-200"
            onClick={expandAll}
            title="Extender todo"
            aria-label="Extender todo"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-dark-300 hover:text-gray-200"
            onClick={collapseAll}
            title="Colapsar todo"
            aria-label="Colapsar todo"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          Todavía no hay sesiones planificadas.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sessions.map((session) => {
            const open = expandedSessions.has(session.id);
            return (
              <details
                key={session.id}
                open={open}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setExpandedSessions((prev) => {
                    const next = new Set(prev);
                    if (open) next.add(session.id);
                    else next.delete(session.id);
                    return next;
                  });
                }}
                className="rounded-xl border border-dark-400 bg-dark-300/30 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-3 w-3 rounded-full"
                      style={{ backgroundColor: getSportColor(session.category) }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">
                        {session.title ?? session.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {getSportLabel(session.category)} ·{" "}
                        {formatTrainerDate(session.start_date_local)}
                      </p>
                    </div>
                    {canEdit && onEditSession && (
                      <button
                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEditSession(session); }}
                        title="Editar sesión (fecha, título, texto)"
                        aria-label={`Editar ${session.title ?? session.name}`}
                        className="shrink-0 rounded-lg text-gray-500 transition-colors hover:bg-dark-300 hover:text-gray-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEdit && onDeleteSession && (
                      <button
                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDeleteSession(session.id); }}
                        title="Eliminar sesión"
                        aria-label={`Eliminar ${session.title ?? session.name}`}
                        className="shrink-0 rounded-lg text-gray-500 transition-colors hover:bg-dark-300 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    { session.merged_with && session.completed_session && (
                      <div className="text-green-400">
                        <CircleCheck className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </summary>

                <div className="mt-3">
                  {session.merged_with && session.completed_session && (
                    <a
                      href={tenantPath(activeTenantId, `/session/${session.completed_session.id}`)}
                      className="mb-4 hover:underline font-semibold rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-200 inline-flex gap-2 w-full"
                    >
                      Ya realizada
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {session.completed_session && analysisBySession?.get(session.completed_session.id)?.analysis?.analysis && (
                    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent-light">Análisis del entrenador</p>
                      <p className="whitespace-pre-wrap text-xs leading-5 text-gray-300">{analysisBySession.get(session.completed_session.id)?.analysis?.analysis}</p>
                      {analysisBySession.get(session.completed_session.id)?.analysis?.profileChange && (
                        <p className="mt-2 border-t border-accent/10 pt-2 text-[11px] text-accent-light">
                          Perfil actualizado: {analysisBySession.get(session.completed_session.id)?.analysis?.profileChange}
                        </p>
                      )}
                    </div>
                  )}
                  {session.workout_text ? (
                    <WorkoutText text={session.workout_text} />
                  ) : (
                    <div className="space-y-1">
                      {(session.objectives ?? []).map((objective, index) => (
                        <p key={index} className="text-sm text-gray-300">
                          {objective.label && (
                            <span className="mr-2 text-[10px] uppercase text-accent-light">
                              {objective.label}
                            </span>
                          )}
                          {objective.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
