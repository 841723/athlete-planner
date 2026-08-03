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
import { getSportCategory } from "@/lib/utils";

interface SpeedChartProps {
  sessions: Session[];
}

export function SpeedChart({ sessions }: SpeedChartProps) {
  const cycling = sessions.filter(
    (s) => getSportCategory(s.sport) === "cycling" && s.avg_speed_ms
  );

  const data = cycling
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      speed: Math.round(s.avg_speed_ms! * 3.6 * 10) / 10,
    }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Velocidad Media (Bicicleta)</h2>
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