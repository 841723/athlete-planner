import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Session } from "@/types/session";

interface CumulativeChartProps {
  sessions: Session[];
}

export function CumulativeChart({ sessions }: CumulativeChartProps) {
  let cumulative = 0;
  const sorted = [...sessions].sort(
    (a, b) => a.start_date_local.localeCompare(b.start_date_local)
  );

  const data = sorted.map((s) => {
    cumulative += (s.distance_m ?? 0) / 1000;
    return {
      date: s.start_date_local.slice(0, 10),
      cumulative: Math.round(cumulative * 10) / 10,
    };
  });

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Distancia Acumulada</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
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
            dataKey="cumulative"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}