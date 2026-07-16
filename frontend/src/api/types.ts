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
