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
import { getWeekNumber, getSessionTime } from "@/lib/utils";

interface TrainingLoadChartProps {
  sessions: Session[];
}

export function TrainingLoadChart({ sessions }: TrainingLoadChartProps) {
  const byWeek: Record<string, number> = {};

  for (const s of sessions) {
    const date = new Date(s.start_date_local);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = weekStart.toISOString().slice(0, 10);
    const hours = getSessionTime(s) / 3600;
    byWeek[key] = (byWeek[key] ?? 0) + hours;
  }

  const data = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, load]) => ({
      week: `W${getWeekNumber(new Date(week))}`,
      load: Math.round(load * 10) / 10,
    }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Carga de Entrenamiento</h2>
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
          <Bar dataKey="load" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}