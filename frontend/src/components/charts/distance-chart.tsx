import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useCharts } from "@/hooks/use-charts";
import { getSportColor } from "@/lib/utils";
import type { SportCategory } from "@/types/session";

export function DistanceChart() {
  const { data } = useCharts();
  const chartData = data?.distanceBySport ?? [];

  const allSports = new Set<string>();
  for (const row of chartData) {
    for (const key of Object.keys(row)) {
      if (key !== "week") allSports.add(key);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Distancia Semanal por Deporte</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f3a" />
          <XAxis dataKey="week" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #2d2d4a",
              borderRadius: "12px",
              color: "#e5e7eb",
            }}
          />
          <Legend />
          {Array.from(allSports).map((sport) => (
            <Bar
              key={sport}
              dataKey={sport}
              fill={getSportColor(sport as SportCategory)}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
