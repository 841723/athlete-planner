import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-context";
import { coachChatKey } from "@/hooks/use-coach-chat";
import { jobsKey } from "@/hooks/use-jobs";
import { invalidateMany } from "@/lib/invalidate";
import { sessionAnalysisKey } from "@/hooks/use-session-analysis";
import type { Job } from "@/types/session";

interface JobEvent {
  job?: Job;
}

function mergeJob(current: Job[] | undefined, job: Job) {
  const jobs = current ?? [];
  const index = jobs.findIndex((item) => item.id === job.id);
  if (index === -1) return [job, ...jobs].slice(0, 50);
  const next = [...jobs];
  next[index] = job;
  return next;
}

function mergeActiveJob(current: Job[] | undefined, job: Job) {
  const jobs = mergeJob(current, job);
  return jobs.filter((item) => item.status === "pending" || item.status === "running");
}

export function RealtimeBridge() {
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activeTenantId) return undefined;

    const source = new EventSource(`/api/events?tenantId=${encodeURIComponent(activeTenantId)}`, { withCredentials: true });
    const refreshState = () => {
      void queryClient.invalidateQueries({ queryKey: jobsKey(activeTenantId) });
      void queryClient.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
    };

    source.addEventListener("ready", refreshState);
    source.addEventListener("job.updated", (event) => {
      try {
        const { job } = JSON.parse((event as MessageEvent<string>).data) as JobEvent;
        if (!job || job.tenant_id !== activeTenantId) return;
        queryClient.setQueryData<Job[]>([...jobsKey(activeTenantId), false], (current) => mergeJob(current, job));
        queryClient.setQueryData<Job[]>([...jobsKey(activeTenantId), true], (current) => mergeActiveJob(current, job));
        if (job.type === "coach_chat") {
          void queryClient.invalidateQueries({ queryKey: coachChatKey(activeTenantId) });
        }
        if (["completed", "failed", "cancelled"].includes(job.status)) {
          invalidateMany(queryClient, ["sessions", "weekly", "stats", "charts", "planned"]);
          if (job.type === "analyze_sessions") {
            void queryClient.invalidateQueries({ queryKey: sessionAnalysisKey(activeTenantId) });
            void queryClient.invalidateQueries({ queryKey: ["profile"] });
            void queryClient.invalidateQueries({ queryKey: ["profile-history"] });
          }
        }
      } catch {
        refreshState();
      }
    });

    source.onerror = () => {
      // EventSource retries automatically; the next ready event refreshes state.
    };
    return () => source.close();
  }, [activeTenantId, queryClient]);

  return null;
}
