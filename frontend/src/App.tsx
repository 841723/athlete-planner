import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/layout/shell";
import { HomePage } from "@/pages/home";
import { CalendarPage } from "@/pages/calendar";
import { WeeklyPage } from "@/pages/weekly";
import { StatsPage } from "@/pages/stats";

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/weekly" element={<WeeklyPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;