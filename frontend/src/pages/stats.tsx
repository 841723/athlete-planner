import { StatsGrid } from "@/components/stats/stats-grid";
import { CumulativeChart } from "@/components/charts/cumulative-chart";
import { VolumeEvolutionChart } from "@/components/charts/volume-evolution-chart";
import { DistanceChart } from "@/components/charts/distance-chart";
import { HoursChart } from "@/components/charts/hours-chart";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { PaceChart } from "@/components/charts/pace-chart";
import { SpeedChart } from "@/components/charts/speed-chart";
import { SwimTimeChart } from "@/components/charts/swim-time-chart";

export function StatsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <StatsGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CumulativeChart />
        <VolumeEvolutionChart />
        <DistanceChart />
        <HoursChart />
        <TrainingLoadChart />
        <PaceChart />
        <SpeedChart />
        <SwimTimeChart />
      </div>
    </div>
  );
}
