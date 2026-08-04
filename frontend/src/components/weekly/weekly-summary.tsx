import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { WeeklySummary, Session } from "@/types/session";
import { SportDistribution } from "./sport-distribution";
import { WeekChart } from "./week-chart";
import { Button } from "@/components/ui/button";

interface WeeklySummaryProps {
  weekly: WeeklySummary[];
  completed: Session[];
  planned: Session[];
}

export function WeeklySummary({ weekly, completed, planned }: WeeklySummaryProps) {
  const [selectedWeek, setSelectedWeek] = useState<WeeklySummary | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Resumen Semanal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WeekChart weekly={weekly} />
        </div>
        <div>
          <SportDistribution weekly={weekly} />
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-3">Detalle por Semana</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-dark-400">
                <th className="text-left py-2 px-3">Semana</th>
                <th className="text-right py-2 px-3">Sesiones</th>
                <th className="text-right py-2 px-3">Horas</th>
                <th className="text-right py-2 px-3">Distancia</th>
                <th className="text-right py-2 px-3">Desnivel</th>
                <th className="text-right py-2 px-3">Planeado</th>
                <th className="text-right py-2 px-3">Realizado</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr
                  key={w.weekStart}
                  className="border-b border-dark-400/50 hover:bg-dark-300/30 cursor-pointer"
                  onClick={() =>
                    setSelectedWeek(selectedWeek === w ? null : w)
                  }
                >
                  <td className="py-2 px-3 font-medium whitespace-nowrap">
                    <span className="text-accent-light font-semibold">W{w.weekNumber}</span>{" "}
                    <span className="text-gray-400">
                      {format(parseISO(w.weekStart), "d MMM")} –{" "}
                      {format(parseISO(w.weekEnd), "d MMM")}
                    </span>
                  </td>
                  <td className="text-right py-2 px-3">{w.sessions}</td>
                  <td className="text-right py-2 px-3">{w.hours}h</td>
                  <td className="text-right py-2 px-3">{w.distance_km} km</td>
                  <td className="text-right py-2 px-3">{w.elevation_m} m</td>
                  <td className="text-right py-2 px-3 text-gray-400">
                    {w.plannedSessions} ses · {w.plannedDistance_km} km
                  </td>
                  <td className="text-right py-2 px-3 text-accent-light">
                    {w.sessions} ses · {w.distance_km} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedWeek && (
          <div className="mt-4 p-4 rounded-xl bg-dark-300/50">
            <h3 className="font-semibold mb-2">
              Semana {selectedWeek.weekNumber}: {format(parseISO(selectedWeek.weekStart), "d MMM")} –{" "}
              {format(parseISO(selectedWeek.weekEnd), "d MMM")}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              {Object.entries(selectedWeek.bySport).map(([sport, count]) => (
                <div key={sport}>
                  <span className="text-gray-400">{sport}: </span>
                  <span className="font-medium">{count} sesiones</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}