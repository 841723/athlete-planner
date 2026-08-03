import { StatsGrid } from "@/components/stats/stats-grid";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsPage() {
  return (
    <div className="animate-fade-in">
      <StatsGrid />
    </div>
  );
}