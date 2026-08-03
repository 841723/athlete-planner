import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Session } from "@/types/session";

interface VolumeEvolutionChartProps {
  sessions: Session[];
}

export function VolumeEvolutionChart({ sessions }: VolumeEvolutionChartProps) {
  const sorted = [...sessions].sort(
    (a, b) => a.start_date_local.localeCompare(b.start_date_local)
  );

  let cumulativeHours = 0;
  let cumulativeDist = 0;

  const data = sorted.map((s) => {
    cumulativeHours += (s.moving_time_s ?? s.elapsed_time_s ?? 0) / 3600;
    cumulativeDist += (s.distance_m ?? 0) / 1000;
    return {
      date: s.start_date_local.slice(0, 10),
      hours: Math.round(cumulativeHours * 10) / 10,
      distance: Math.round(cumulativeDist * 10) / 10,
    };
  });

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Evolución del Volumen</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
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