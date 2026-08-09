import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchPlans } from "@/services/trainer";
import { invalidateMany } from "@/lib/invalidate";
import type { Plan } from "@/types/session";

const POLL_MS = 2000;

const DEPENDENT_KEYS = [
  "planned",
  "sessions",
  "weekly",
  "stats",
  "charts",
  "stats-records",
  "profile",
  "profile-history",
];

function activeKey(plans: Plan[]) {
  return plans
    .filter((p) => p.status === "pending" || p.status === "generating")
    .map((p) => `${p.id}:${p.status}`)
    .sort()
    .join(",");
}

// Observa el estado de generación de planes. Mientras haya un plan
// pending/generating, hace polling de /api/plans; al terminar (completed/failed)
// invalida las queries dependientes para que la UI se actualice sola.
export function usePlanGenerationWatcher() {
  const qc = useQueryClient();
  const prevRef = useRef<string>(activeKey(qc.getQueryData<Plan[]>(["plans"]) ?? []));

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      let plans: Plan[] = [];
      try {
        const data = await qc.fetchQuery({
          queryKey: ["plans"],
          queryFn: fetchPlans,
          staleTime: 0,
        });
        plans = Array.isArray(data) ? data : [];
      } catch {
        return;
      }
      if (disposed) return;

      const key = activeKey(plans);
      const prev = prevRef.current;
      if (prev && prev !== key) {
        invalidateMany(qc, DEPENDENT_KEYS);
      }
      prevRef.current = key;

      if (key) {
        if (!timer) timer = setInterval(tick, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    void tick();

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
  }, [qc]);

  return null;
}
