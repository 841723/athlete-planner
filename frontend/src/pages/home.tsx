import { HeroStats } from "@/components/home/hero-stats";
import { TodayTomorrow } from "@/components/home/today-tomorrow";
import { StreakCard } from "@/components/home/streak-card";
import { RecentActivity } from "@/components/home/recent-activity";
import { WeeklyVolume } from "@/components/home/weekly-volume";
import { UpcomingGoals } from "@/components/home/upcoming-goals";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessions } from "@/hooks/use-sessions";

export function HomePage() {
  const { data, isLoading, error, refetch } = useSessions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <DataLoadError message={error.message} onRetry={() => void refetch()} />;
  }

  const completed = data?.completed ?? [];
  const planned = data?.planned ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inicio</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <UpcomingGoals />
        </div>
        <div className="space-y-4">
          <StreakCard />
          <WeeklyVolume />
        </div>
      </div>
      <HeroStats />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <TodayTomorrow completed={completed} planned={planned} />
          <RecentActivity />
        </div>
        <div className="space-y-4" />
      </div>
    </div>
  );
}

function DataLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm text-red-300">No se pudieron cargar los entrenamientos.</p>
      <p className="mt-1 text-xs text-gray-500">{message}</p>
      <button type="button" className="btn btn-primary mt-4" onClick={onRetry}>Reintentar</button>
    </div>
  );
}
