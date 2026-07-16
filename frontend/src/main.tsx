import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import "./index.css";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import DiagnosePage from "./pages/Diagnose";
import IncidentDetailPage from "./pages/IncidentDetail";
import IncidentsPage from "./pages/Incidents";
import IntegrationsPage from "./pages/Integrations";
import KnowledgeBasePage from "./pages/KnowledgeBase";
import LandingPage from "./pages/Landing";
import PipelinesPage from "./pages/Pipelines";
import SettingsPage from "./pages/Settings";

function AppShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/diagnose" element={<DiagnosePage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
