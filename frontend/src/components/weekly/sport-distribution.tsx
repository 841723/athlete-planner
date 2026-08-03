import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { WeeklySummary } from "@/types/session";
import { SPORT_COLORS, SPORT_LABELS } from "@/types/session";

interface SportDistributionProps {
  weekly: WeeklySummary[];
}

export function SportDistribution({ weekly }: SportDistributionProps) {
  const totals: Record<string, number> = {};
  for (const w of weekly) {
    for (const [sport, hours] of Object.entries(w.bySport)) {
      totals[sport] = (totals[sport] ?? 0) + hours;
    }
  }

  const data = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([sport, hours]) => ({
      name: SPORT_LABELS[sport as keyof typeof SPORT_LABELS] ?? sport,
      value: Math.round(hours * 10) / 10,
      color: SPORT_COLORS[sport as keyof typeof SPORT_COLORS] ?? "#6b7280",
    }));

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold mb-4">Distribución por Deporte</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #2d2d4a",
              borderRadius: "12px",
              color: "#e5e7eb",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}