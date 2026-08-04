import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCharts } from "@/hooks/use-charts";

export function SpeedChart() {
  const { data } = useCharts();
  const chartData = data?.cyclingSpeeds ?? [];

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Velocidad Media (Bicicleta)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
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
          <Line
            type="monotone"
            dataKey="speed"
            stroke="#facc15"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
