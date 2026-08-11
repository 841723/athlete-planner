import { useState } from "react";
import type { WeeklySummary } from "@/types/session";
import { SportDistribution } from "./sport-distribution";
import { WeekChart } from "./week-chart";

interface WeeklySummaryProps {
  weekly: WeeklySummary[];
}

export function WeeklySummary({ weekly }: WeeklySummaryProps) {
  const [selectedWeek, setSelectedWeek] = useState<WeeklySummary | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Resumen Semanal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WeekChart />
        </div>
        <div>
          <SportDistribution />
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-3">Detalle por Semana</h2>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-dark-400">
                <th className="text-left py-2 px-3">Semana</th>
                <th className="text-right py-2 px-3">Sesiones</th>
                <th className="text-right py-2 px-3">Horas</th>
                <th className="text-right py-2 px-3">Distancia</th>
                <th className="text-right py-2 px-3">Desnivel</th>
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
                    <span className="text-accent-light font-semibold">Semana #{w.weekNumber}</span>
                  </td>
                  <td className="text-right py-2 px-3">{w.sessions}</td>
                  <td className="text-right py-2 px-3">{w.hours}h</td>
                  <td className="text-right py-2 px-3">{w.distance_km} km</td>
                  <td className="text-right py-2 px-3">{w.elevation_m} m</td>
                  <td className="text-right py-2 px-3 text-accent-light">
                    {w.sessions} ses · {w.distance_km} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {weekly.map((w) => (
            <div
              key={w.weekStart}
              className="p-3 rounded-xl bg-dark-300/50 cursor-pointer transition-colors hover:bg-dark-300"
              onClick={() => setSelectedWeek(selectedWeek === w ? null : w)}
            >
              <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-accent-light">Semana #{w.weekNumber}</span>
                <span className="text-xs text-gray-400">{w.hours}h</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sesiones</span>
                  <span>{w.sessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distancia</span>
                  <span>{w.distance_km} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Desnivel</span>
                  <span>{w.elevation_m} m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedWeek && (
          <div className="mt-4 p-4 rounded-xl bg-dark-300/50">
            <h3 className="font-semibold mb-2">
              Semana #{selectedWeek.weekNumber}
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
