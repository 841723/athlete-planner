import { useWeekly } from "@/hooks/use-weekly";
import { WeeklySummary } from "@/components/weekly/weekly-summary";
import { Skeleton } from "@/components/ui/skeleton";

export function WeeklyPage() {
  const { data: weekly, isLoading, error, refetch } = useWeekly();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-red-300">No se pudo cargar el resumen semanal.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <WeeklySummary weekly={weekly ?? []} />
    </div>
  );
}
