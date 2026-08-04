import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCharts } from "@/hooks/use-charts";

export function VolumeEvolutionChart() {
  const { data } = useCharts();
  const chartData = data?.volumeEvolution ?? [];

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Evolución del Volumen</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f3a" />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #2d2d4a",
              borderRadius: "12px",
              color: "#e5e7eb",
            }}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stackId="1"
            stroke="#818cf8"
            fill="#818cf8"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="distance"
            stackId="2"
            stroke="#f472b6"
            fill="#f472b6"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
