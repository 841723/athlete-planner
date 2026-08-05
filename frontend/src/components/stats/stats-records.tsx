import { useNavigate } from "react-router-dom";
import { useStatsRecords } from "@/hooks/use-stats-records";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { StatRecord, BestEffortRecord } from "@/types/session";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatPace100(secPer100m: number): string {
  const min = Math.floor(secPer100m / 60);
  const sec = Math.round(secPer100m % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function RecordCard({ record }: { record: StatRecord }) {
  const navigate = useNavigate();
  const isClickable = !!record.sessionId;

  return (
    <div
      className={`card p-5 ${isClickable ? "card-hover cursor-pointer" : ""}`}
      onClick={isClickable ? () => navigate(`/session/${record.sessionId}`) : undefined}
    >
      <div className="text-2xl mb-2">{record.icon}</div>
      <div className="stat-label mb-1">{record.label}</div>
      <div className="stat-value">{record.display}</div>
      {record.sessionName && (
        <div className="text-xs text-gray-500 mt-1 truncate">
          {record.sessionDate} · {record.sessionName}
        </div>
      )}
    </div>
  );
}

function BestEffortList({
  efforts,
  sportLabel,
  icon,
}: {
  efforts: BestEffortRecord[];
  sportLabel: string;
  icon: string;
}) {
  const navigate = useNavigate();

  if (efforts.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {sportLabel}
        </h3>
      </div>
      <div className="space-y-2">
        {efforts.map((e, i) => (
          <div
            key={`${e.name}-${i}`}
            className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-dark-300/50 cursor-pointer transition-colors"
            onClick={() => navigate(`/session/${e.sessionId}`)}
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-4 text-right">{i + 1}</span>
              <span className="font-medium">{e.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-accent font-mono">{formatDuration(e.time_s)}</span>
              <span className="text-gray-500 text-xs">{e.sessionDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsRecords() {
  const { data, isLoading } = useStatsRecords();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { records, bestEfforts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Récords personales</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {records.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </div>
      </div>

      {(bestEfforts.running.length > 0 ||
        bestEfforts.cycling.length > 0 ||
        bestEfforts.swimming.length > 0) && (
        <div>
          <h2 className="text-xl font-bold mb-4">Mejores marcas por deporte</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BestEffortList efforts={bestEfforts.running} sportLabel="Carrera" icon="🏃" />
            <BestEffortList efforts={bestEfforts.cycling} sportLabel="Bicicleta" icon="🚴" />
            <BestEffortList efforts={bestEfforts.swimming} sportLabel="Natación" icon="🏊" />
          </div>
        </div>
      )}
    </div>
  );
}
