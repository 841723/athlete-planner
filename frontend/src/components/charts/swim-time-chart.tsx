import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Session } from "@/types/session";
import { getSportCategory } from "@/lib/utils";

interface SwimTimeChartProps {
  sessions: Session[];
}

export function SwimTimeChart({ sessions }: SwimTimeChartProps) {
  const swimming = sessions.filter(
    (s) => getSportCategory(s.sport) === "swimming" && s.moving_time_s
  );

  const data = swimming
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((s) => ({
      date: s.start_date_local.slice(0, 10),
      minutes: Math.round((s.moving_time_s! / 60) * 10) / 10,
    }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Tiempo Nadando (min)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
          <Bar dataKey="minutes" fill="#60a5fa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}