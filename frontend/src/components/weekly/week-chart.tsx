import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { WeeklySummary } from "@/types/session";

interface WeekChartProps {
  weekly: WeeklySummary[];
}

export function WeekChart({ weekly }: WeekChartProps) {
  const data = weekly.map((w) => ({
    week: `W${w.weekNumber}`,
    hours: w.hours,
    planned: w.plannedHours,
    distance: w.distance_km,
  }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Horas Entrenadas por Semana</h2>
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
          <Bar dataKey="hours" fill="#818cf8" radius={[4, 4, 0, 0]} name="Realizado" />
          <Bar dataKey="planned" fill="#4ade80" radius={[4, 4, 0, 0]} name="Planeado" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}