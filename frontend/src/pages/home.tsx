import { HeroStats } from "@/components/home/hero-stats";
import { TodayTomorrow } from "@/components/home/today-tomorrow";
import { UpcomingGoals } from "@/components/home/upcoming-goals";
import { StreakCard } from "@/components/home/streak-card";
import { RecentActivity } from "@/components/home/recent-activity";
import { WeeklyVolume } from "@/components/home/weekly-volume";
import { SyncButton } from "@/components/layout/sync-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessions } from "@/hooks/use-sessions";
import { usePermissions } from "@/hooks/use-permissions";

export function HomePage() {
  const { data, isLoading } = useSessions();
  const perms = usePermissions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const completed = data?.completed ?? [];
  const planned = data?.planned ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inicio</h1>
        {perms.canSync && <SyncButton />}
      </div>
      <HeroStats />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <TodayTomorrow completed={completed} planned={planned} />
          <RecentActivity />
        </div>
        <div className="space-y-4">
          <UpcomingGoals />
          <StreakCard />
          <WeeklyVolume />
        </div>
      </div>
    </div>
  );
}
