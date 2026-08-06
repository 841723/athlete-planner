import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SessionSegment, SportCategory } from "@/types/session";
import { pacePer100m } from "@/lib/utils";

interface SessionLapsChartProps {
  segments: SessionSegment[];
  category: SportCategory | undefined;
}

const tooltipStyle = {
  backgroundColor: "#1a1a2e",
  border: "1px solid #2d2d4a",
  borderRadius: "12px",
  color: "#e5e7eb",
  fontSize: 12,
};

export function SessionLapsChart({ segments, category }: SessionLapsChartProps) {
  const { paceData, hrData } = useMemo(() => {
    const isSwim = category === "swimming";
    const isCycling = category === "cycling";
    const paceData: { lap: number; value: number }[] = [];
    const hrData: { lap: number; value: number }[] = [];
    segments.forEach((seg, i) => {
      let value: number | undefined;
      if (isSwim) {
        value = pacePer100m(seg.time_s, seg.distance_m);
      } else if (isCycling) {
        value = seg.avg_speed_ms != null ? Number((seg.avg_speed_ms * 3.6).toFixed(1)) : undefined;
      } else {
        value = seg.avg_pace_s_per_km;
      }
      if (value != null && isFinite(value)) paceData.push({ lap: i + 1, value });
      if (seg.avg_heartrate != null) hrData.push({ lap: i + 1, value: seg.avg_heartrate });
    });
    return { paceData, hrData };
  }, [segments, category]);

  if (paceData.length < 2 && hrData.length < 2) return null;

  const paceUnit = category === "swimming" ? "min/100m" : category === "cycling" ? "km/h" : "min/km";
  const paceTitle = category === "swimming" ? "Ritmo por vuelta" : category === "cycling" ? "Velocidad por vuelta" : "Ritmo por vuelta";
  const paceColor = category === "cycling" ? "#facc15" : "#f472b6";

  return (
    <div className="card p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Por vueltas</h2>
      {paceData.length >= 2 && (
        <>
          <div className="text-xs text-gray-500 mb-2">{paceTitle} ({paceUnit})</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f3a" />
              <XAxis dataKey="lap" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `V${v}`} />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                domain={["auto", "auto"]}
                reversed={category !== "cycling"}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} ${paceUnit}`, paceTitle]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={paceColor}
                strokeWidth={2}
                dot={{ r: 3, fill: paceColor, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
      {hrData.length >= 2 && (
        <>
          {paceData.length >= 2 && <div className="mt-4" />}
          <div className="text-xs text-gray-500 mb-2">FC media por vuelta (bpm)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f3a" />
              <XAxis dataKey="lap" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `V${v}`} />
              <YAxis stroke="#6b7280" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} bpm`, "FC media"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f87171", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
