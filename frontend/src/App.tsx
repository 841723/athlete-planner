import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/layout/shell";
import { TenantGuard } from "@/components/layout/tenant-guard";
import { HomePage } from "@/pages/home";
import { CalendarPage } from "@/pages/calendar";
import { WeeklyPage } from "@/pages/weekly";
import { StatsPage } from "@/pages/stats";
import { PlannedPage } from "@/pages/planned";
import { SessionDetailPage } from "@/pages/session-detail";
import { ConfigLayout } from "@/components/config/config-layout";
import { GeneralTab } from "@/components/config/general-tab";
import { GoalsTab } from "@/components/config/goals-tab";
import { AiTab } from "@/components/config/ai-tab";
import { PromptsTab } from "@/components/config/prompts-tab";
import { EquipmentTab } from "@/components/config/equipment-tab";
import { AccessTab } from "@/components/config/access-tab";
import { SyncTab } from "@/components/config/sync-tab";
import { useAuth } from "@/components/auth/auth-context";
import { tenantPath } from "@/lib/tenant";
import { usePlanGenerationWatcher } from "@/hooks/use-plan-generation-watcher";

function HomeRedirect() {
  const { activeTenantId } = useAuth();
  return <Navigate to={tenantPath(activeTenantId, "/")} replace />;
}

function App() {
  usePlanGenerationWatcher();
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<TenantGuard />}>
          <Route path="/:tenantId" element={<HomePage />} />
          <Route path="/:tenantId/calendar" element={<CalendarPage />} />
          <Route path="/:tenantId/weekly" element={<WeeklyPage />} />
          <Route path="/:tenantId/stats" element={<StatsPage />} />
          <Route path="/:tenantId/planned" element={<PlannedPage />} />
          <Route path="/:tenantId/session/:id" element={<SessionDetailPage />} />
          <Route path="/:tenantId/config" element={<ConfigLayout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralTab />} />
            <Route path="goals" element={<GoalsTab />} />
            <Route path="models" element={<AiTab />} />
            <Route path="prompts" element={<PromptsTab />} />
            <Route path="equipment" element={<EquipmentTab />} />
            <Route path="access" element={<AccessTab />} />
            <Route path="sync" element={<SyncTab />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
