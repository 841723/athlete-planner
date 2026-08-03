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
import type { Session } from "@/types/session";
import { getSportCategory, getSportColor, getSportLabel, getWeekNumber } from "@/lib/utils";

interface DistanceChartProps {
  sessions: Session[];
}

export function DistanceChart({ sessions }: DistanceChartProps) {
  const byWeek: Record<string, Record<string, number>> = {};

  for (const s of sessions) {
    const date = new Date(s.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = weekStart.toISOString().slice(0, 10);

    if (!byWeek[key]) byWeek[key] = {};
    const sport = getSportCategory(s.sport);
    const dist = (s.distance_m ?? 0) / 1000;
    byWeek[key][sport] = (byWeek[key][sport] ?? 0) + dist;
  }

  const data = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, sports]) => ({
      week: `W${getWeekNumber(new Date(week))}`,
      ...sports,
    }));

  const allSports = new Set<string>();
  for (const sports of Object.values(byWeek)) {
    for (const sport of Object.keys(sports)) {
      allSports.add(sport);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Distancia Semanal por Deporte</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
            <Bar key={sport} dataKey={sport} fill={getSportColor(sport)} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}