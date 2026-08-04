import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useCharts } from "@/hooks/use-charts";
import { SPORT_COLORS, SPORT_LABELS } from "@/types/session";
import type { SportCategory } from "@/types/session";

export function SportDistribution() {
  const { data } = useCharts();
  const chartData = (data?.sportDistribution ?? []).map((entry) => ({
    name: SPORT_LABELS[entry.sport as SportCategory] ?? entry.sport,
    value: entry.value,
    color: SPORT_COLORS[entry.sport as SportCategory] ?? "#6b7280",
  }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Distribución por Deporte</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #2d2d4a",
              borderRadius: "12px",
              color: "#e5e7eb",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
