import type {
  DashboardStats,
  Diagnosis,
  Health,
  IncidentDetail,
  IncidentStatus,
  IncidentSummary,
  PipelineRow,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/health"),
  dashboard: () => request<DashboardStats>("/v1/dashboard"),
  incidents: (status?: string) =>
    request<IncidentSummary[]>(`/v1/incidents${status ? `?status=${status}` : ""}`),
  incident: (id: string) => request<IncidentDetail>(`/v1/incidents/${id}`),
  pipelines: () => request<PipelineRow[]>("/v1/pipelines"),
  updateStatus: (id: string, status: IncidentStatus, notes = "") =>
    request<IncidentSummary>(`/v1/incidents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, resolution_notes: notes }),
    }),
  feedback: (id: string, verdict: string, comment = "") =>
    request<{ ok: boolean }>(`/v1/incidents/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ verdict, comment }),
    }),
  diagnose: (log: string, platform = "generic", context = "") =>
    request<Diagnosis>("/v1/diagnose", {
      method: "POST",
      body: JSON.stringify({ log, platform, context }),
    }),
};

export * from "./types";
