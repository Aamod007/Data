"""Pydantic schemas for the REST API."""
from datetime import datetime

from pydantic import BaseModel, Field

from .models import IncidentStatus, PlatformType, RootCauseCategory, RunStatus


# ---------- Ingestion ----------

class TaskEventIn(BaseModel):
    """A task/node-level event within a run event."""

    task_id: str
    name: str = ""
    node_type: str = ""
    status: RunStatus
    try_number: int = 1
    started_at: datetime | None = None
    ended_at: datetime | None = None
    upstream_task_ids: list[str] = Field(default_factory=list)
    # raw log text; redacted before storage. Capped so one webhook can't OOM
    # the server or bloat the incident store.
    log: str = Field(default="", max_length=2_000_000)


class RunEventIn(BaseModel):
    """Canonical run event — what every connector normalizes into."""

    platform: PlatformType
    pipeline_external_id: str
    pipeline_name: str = ""
    run_external_id: str
    status: RunStatus
    trigger: str = "scheduled"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    config_snapshot: dict = Field(default_factory=dict)
    tasks: list[TaskEventIn] = Field(default_factory=list)


class IngestAck(BaseModel):
    run_id: str
    incident_id: str | None = None
    deduplicated: bool = False


# ---------- Ad-hoc diagnosis ----------

class AdhocDiagnoseIn(BaseModel):
    platform: PlatformType = PlatformType.generic
    log: str = Field(min_length=1, max_length=2_000_000)
    context: str = Field(default="", max_length=10_000)  # what were you running?


# ---------- Diagnosis output ----------

class EvidenceOut(BaseModel):
    source: str
    quote: str


class FixOut(BaseModel):
    title: str
    type: str = "manual"  # sql_patch | config_change | retry | code_change | manual | escalate
    steps: list[str] = Field(default_factory=list)
    diff: str = ""
    risk: str = "low"


class DiagnosisOut(BaseModel):
    id: str
    root_cause_category: RootCauseCategory
    root_cause_summary: str
    explanation: str
    evidence: list[EvidenceOut]
    fixes: list[FixOut]
    confidence: float
    is_transient: bool
    engine: str
    model_version: str
    latency_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Incidents ----------

class IncidentSummary(BaseModel):
    id: str
    pipeline_id: str
    pipeline_name: str = ""
    platform: PlatformType | None = None
    title: str
    status: IncidentStatus
    fingerprint: str
    occurrence_count: int
    first_seen_at: datetime
    last_seen_at: datetime
    root_cause_category: RootCauseCategory | None = None
    root_cause_summary: str = ""
    confidence: float | None = None


class IncidentDetail(IncidentSummary):
    run_id: str
    resolution_notes: str = ""
    diagnoses: list[DiagnosisOut] = Field(default_factory=list)
    logs: list[dict] = Field(default_factory=list)  # [{task, content}]


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    resolution_notes: str = ""


class FeedbackIn(BaseModel):
    verdict: str  # helpful | wrong | fixed_it
    comment: str = ""


# ---------- Dashboard ----------

class DashboardStats(BaseModel):
    total_incidents: int
    open_incidents: int
    resolved_incidents: int
    incidents_by_category: dict[str, int]
    incidents_by_platform: dict[str, int]
    recent_incidents: list[IncidentSummary]
    avg_confidence: float
    recurring_incidents: int
