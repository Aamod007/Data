import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { Layout } from "./components";
import DashboardPage from "./pages/Dashboard";
import DiagnosePage from "./pages/Diagnose";
import IncidentDetailPage from "./pages/IncidentDetail";
import IncidentsPage from "./pages/Incidents";
import PipelinesPage from "./pages/Pipelines";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/diagnose" element={<DiagnosePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>
);
