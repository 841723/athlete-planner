import { useState } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useWeeklySummary } from "@/hooks/use-weekly-summary";
import { WeeklySummary } from "@/components/weekly/weekly-summary";
import { Skeleton } from "@/components/ui/skeleton";

export function WeeklyPage() {
  const { data, isLoading } = useSessions();
  const completed = data?.completed ?? [];
  const planned = data?.planned ?? [];
  const weekly = useWeeklySummary(completed, planned);

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
      <WeeklySummary weekly={weekly} completed={completed} planned={planned} />
    </div>
  );
}