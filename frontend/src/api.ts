/** API types mirroring the backend Pydantic schemas. */

export type IncidentStatus = "open" | "acknowledged" | "resolved" | "ignored";

export interface Evidence {
  source: string;
  quote: string;
}

export interface Fix {
  title: string;
  type: string;
  steps: string[];
  diff: string;
  risk: string;
}

export interface Diagnosis {
  id: string;
  root_cause_category: string;
  root_cause_summary: string;
  explanation: string;
  evidence: Evidence[];
  fixes: Fix[];
  confidence: number;
  is_transient: boolean;
  engine: string;
  model_version: string;
  latency_ms: number;
  created_at: string;
}

export interface IncidentSummary {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  platform: string | null;
  title: string;
  status: IncidentStatus;
  fingerprint: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  root_cause_category: string | null;
  root_cause_summary: string;
  confidence: number | null;
}

export interface IncidentDetail extends IncidentSummary {
  run_id: string;
  resolution_notes: string;
  diagnoses: Diagnosis[];
  logs: { task: string; content: string; redactions?: number }[];
}

export interface DashboardStats {
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  incidents_by_category: Record<string, number>;
  incidents_by_platform: Record<string, number>;
  recent_incidents: IncidentSummary[];
  avg_confidence: number;
  recurring_incidents: number;
}

export interface PipelineRow {
  id: string;
  name: string;
  platform: string;
  external_id: string;
  run_count: number;
  failed_count: number;
}

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
