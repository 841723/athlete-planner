import { useWeekly } from "@/hooks/use-weekly";
import { WeeklySummary } from "@/components/weekly/weekly-summary";
import { Skeleton } from "@/components/ui/skeleton";

export function WeeklyPage() {
  const { data: weekly, isLoading } = useWeekly();

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

  return (
    <div className="animate-fade-in">
      <WeeklySummary weekly={weekly ?? []} />
    </div>
  );
}
