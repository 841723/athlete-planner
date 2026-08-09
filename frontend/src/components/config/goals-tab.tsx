import { useEffect, useState } from "react";
import { parseISO, differenceInDays } from "date-fns";
import { getWeekNumber } from "@/lib/utils";
import { CalendarCheck, Loader2, Plus, Save, Star, Trash } from "lucide-react";
import { useGoals, useUpdateGoals } from "@/hooks/use-goals";
import { useMeta } from "@/hooks/use-meta";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RaceGoal } from "@/types/session";

function emptyGoal(): RaceGoal {
  return { week: 0, label: "", date: "", targetPace: "", url: "", color: "", isPrimary: false };
}

function faviconUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

function GoalCard({ goal, planStart, today }: { goal: RaceGoal; planStart: string; today: Date }) {
  const goalDate = parseISO(goal.date);
  const daysRemaining = differenceInDays(goalDate, today);
  const isPast = daysRemaining < 0;
  const totalDays = Math.max(1, differenceInDays(goalDate, parseISO(planStart)));
  const elapsedDays = Math.max(0, differenceInDays(today, parseISO(planStart)));
  const goalProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);
  const favicon = faviconUrl(goal.url);
  const color = goal.isPrimary ? goal.color || "#3b82f6" : undefined;

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isPast
          ? "border-green-500/20 bg-green-500/5"
          : color
          ? "border-dark-400 bg-dark-300/30"
          : "border-dark-400 bg-dark-300/30"
      }`}
      style={color ? { borderColor: `${color}66`, background: `${color}12`, boxShadow: `0 0 0 1px ${color}66` } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
          {color ? <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} /> : null}
          {goal.url ? (
            <a
              href={goal.url}
              target="_blank"
              rel="noopener noreferrer"
              title={goal.label}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
            >
              {favicon ? (
                <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" referrerPolicy="no-referrer" />
              ) : null}
              <span className="truncate">{goal.label || "Sin etiqueta"}</span>
            </a>
          ) : (
            <>
              {favicon ? (
                <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" referrerPolicy="no-referrer" />
              ) : null}
              <span className="truncate">{goal.label || "Sin etiqueta"}</span>
            </>
          )}
          {goal.isPrimary && (
            <span
              className="shrink-0 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: color ?? "#3b82f6" }}
            >
              <Star className="w-3 h-3" /> Principal
            </span>
          )}
        </span>
        <span className="text-xs text-gray-500 shrink-0">
          {goal.week ? `Semana ${goal.week}` : ""}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {goal.date
            ? isPast
              ? `Completado (${new Date(goal.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })})`
              : `${daysRemaining} días restantes`
            : "Sin fecha"}
        </span>
        {goal.targetPace && goal.targetPace !== "—" && (
          <span className="text-xs font-medium" style={color ? { color } : undefined}>{goal.targetPace}</span>
        )}
      </div>
      {!isPast && (
        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${goalProgress}%`, backgroundColor: color ?? "#4ade80" }} />
        </div>
      )}
    </div>
  );
}

export function GoalsTab() {
  const { data: goals, isLoading } = useGoals();
  const { data: meta } = useMeta();
  const updateGoalsMutation = useUpdateGoals();
  const perms = usePermissions();
  const canManage = perms.canManageUsers;

  const [edits, setEdits] = useState<RaceGoal[]>([]);
  useEffect(() => {
    if (goals) setEdits(goals);
  }, [goals]);

  if (isLoading) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const today = new Date();
  const upcoming = [...(goals ?? [])].sort(
    (a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.week - b.week
  );

  function patchGoal(index: number, patch: Partial<RaceGoal>) {
    setEdits((g) => g.map((goal, i) => (i === index ? { ...goal, ...patch } : goal)));
  }

  function togglePrimary(index: number) {
    setEdits((g) => g.map((goal, i) => (i === index ? { ...goal, isPrimary: true } : { ...goal, isPrimary: false, color: "" })));
  }

  const label = (text: string) => (
    <label className="text-xs text-gray-400 block mb-1">{text}</label>
  );

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Star className="w-4 h-4" /> Próximos objetivos
        </h2>
        {!goals || goals.length === 0 ? (
          <p className="text-sm text-gray-500">
            Todavía no hay objetivos. Añade el primero en el editor de abajo.
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((goal, i) => (
              <GoalCard key={`${goal.week}-${i}`} goal={goal} planStart={meta?.planStart ?? goal.date} today={today} />
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" /> Editar objetivos
        </h2>
        {!canManage ? (
          <p className="text-sm text-gray-400">
            Solo los usuarios con permisos de edición pueden modificar los objetivos.
          </p>
        ) : (
          <div className="space-y-4">
            {edits.map((g, i) => {
              const isPrimary = !!g.isPrimary;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 space-y-3 ${
                    isPrimary ? "border-accent/40 bg-accent/5" : "border-dark-400 bg-dark-300/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">
                        Objetivo {i + 1}
                      </span>
                      {isPrimary && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-light">
                          <Star className="w-3 h-3" /> Principal
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                      onClick={() => setEdits((gs) => gs.filter((_, j) => j !== i))}
                    >
                      <Trash className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 lg:col-span-3">
                      {label("Etiqueta")}
                      <input
                        className="input text-sm"
                        placeholder="Ej. Ironman 70.3 Valencia"
                        value={g.label}
                        onChange={(e) => patchGoal(i, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      {label("Fecha")}
                      <input
                        type="date"
                        className="input text-sm"
                        value={g.date ?? ""}
                        onChange={(e) => patchGoal(i, { date: e.target.value })}
                      />
                    </div>
                    <div>
                      {label("Ritmo objetivo")}
                      <input
                        className="input text-sm"
                        placeholder="Ej. 6:30 min/km"
                        value={g.targetPace ?? ""}
                        onChange={(e) => patchGoal(i, { targetPace: e.target.value })}
                      />
                    </div>
                    <div>
                      {label("URL de la carrera")}
                      <input
                        className="input text-sm"
                        placeholder="https://..."
                        value={g.url ?? ""}
                        onChange={(e) => patchGoal(i, { url: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant={isPrimary ? "outline" : "ghost"}
                        className="text-xs px-3 py-2"
                        onClick={() => togglePrimary(i)}
                        title={isPrimary ? "Es el objetivo principal" : "Marcar como objetivo principal"}
                      >
                        <Star className="w-3.5 h-3.5" />
                        {isPrimary ? "Principal" : "Marcar principal"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    {g.date ? (
                      <>Semana <span className="font-semibold text-accent-light">
                        {getWeekNumber(parseISO(g.date), meta?.trainingWeekOneStart ?? "")}
                      </span> calculada desde la fecha del evento y la semana 1 del plan.</>
                    ) : (
                      "Añade una fecha para calcular automáticamente la semana del objetivo."
                    )}
                  </div>

                  {isPrimary && (
                    <div className="border-t border-dark-400 pt-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-32">
                          {label("Color destacado")}
                          <input
                            type="color"
                            className="w-full h-9 rounded-lg border border-dark-400 bg-dark-300 cursor-pointer p-0.5"
                            value={g.color ?? "#3b82f6"}
                            onChange={(e) => patchGoal(i, { color: e.target.value })}
                          />
                        </div>
                        <div className="w-36">
                          {label("O código hex")}
                          <input
                            className="input text-sm font-mono"
                            placeholder="#3b82f6"
                            value={g.color ?? ""}
                            onChange={(e) => patchGoal(i, { color: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-gray-500 self-end pb-1">
                          El color destaca el objetivo principal en Inicio y en el Calendario.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" className="text-xs" onClick={() => setEdits((gs) => [...gs, emptyGoal()])}>
                <Plus className="w-3.5 h-3.5" /> Añadir objetivo
              </Button>
              <Button onClick={() => updateGoalsMutation.mutate(edits)} disabled={updateGoalsMutation.isPending}>
                {updateGoalsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
