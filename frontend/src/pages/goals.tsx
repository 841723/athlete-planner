import { GoalsTimeline } from "@/components/goals/goals-timeline";
import { Skeleton } from "@/components/ui/skeleton";

export function GoalsPage() {
  return (
    <div className="animate-fade-in">
      <GoalsTimeline />
    </div>
  );
}