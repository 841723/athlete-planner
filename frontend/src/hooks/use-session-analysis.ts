import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSessionAnalysis, startSessionAnalysis } from "@/services/api";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/components/ui/toast";

export function sessionAnalysisKey(tenantId: string | null) {
  return ["session-analysis", tenantId];
}

export function useSessionAnalysis() {
  const { activeTenantId } = useAuth();
  return useQuery({
    queryKey: sessionAnalysisKey(activeTenantId),
    queryFn: fetchSessionAnalysis,
    enabled: Boolean(activeTenantId),
  });
}

export function useStartSessionAnalysis() {
  const qc = useQueryClient();
  const { activeTenantId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: startSessionAnalysis,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: sessionAnalysisKey(activeTenantId) });
      if (result.pending === 0) toast({ type: "success", title: "No hay entrenamientos nuevos para analizar" });
      else toast({ type: "success", title: "Análisis iniciado", description: `${result.pending} entrenamiento${result.pending === 1 ? "" : "s"} pendiente${result.pending === 1 ? "" : "s"}.` });
    },
    onError: (error: Error) => toast({ type: "error", title: "No se pudo iniciar el análisis", description: error.message }),
  });
}
