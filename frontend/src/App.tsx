import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/layout/shell";
import { HomePage } from "@/pages/home";
import { CalendarPage } from "@/pages/calendar";
import { WeeklyPage } from "@/pages/weekly";
import { StatsPage } from "@/pages/stats";
import { PlannedPage } from "@/pages/planned";
import { SessionDetailPage } from "@/pages/session-detail";
import { ConfigPage } from "@/pages/config";
import { usePlanGenerationWatcher } from "@/hooks/use-plan-generation-watcher";

function App() {
  usePlanGenerationWatcher();
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/weekly" element={<WeeklyPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/planned" element={<PlannedPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/session/:id" element={<SessionDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;