import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCharts } from "@/hooks/use-charts";

export function TrainingLoadChart() {
  const { data } = useCharts();
  const chartData = data?.trainingLoad ?? [];

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Carga de Entrenamiento</h2>
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
          <Bar dataKey="load" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
