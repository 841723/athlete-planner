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

interface PaceChartProps {
  sessions: Session[];
}

export function PaceChart({ sessions }: PaceChartProps) {
  const running = sessions.filter(
    (s) => getSportCategory(s.sport) === "running" && s.avg_pace_s_per_km
  );

  const data = running
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      pace: s.avg_pace_s_per_km!,
    }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Ritmo Medio (Carrera)</h2>
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
            dataKey="pace"
            stroke="#f472b6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}