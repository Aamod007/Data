"""Canonical Pipeline Event Model (CPEM) — SQLAlchemy ORM models.

Every source platform (Airflow, dbt, ADF, Databricks...) is normalized into
these entities so the diagnosis engine is platform-agnostic.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlatformType(str, enum.Enum):
    airflow = "airflow"
    dbt = "dbt"
    adf = "adf"
    databricks = "databricks"
    snowflake = "snowflake"
    fabric = "fabric"
    spark = "spark"
    generic = "generic"


class RunStatus(str, enum.Enum):
    running = "running"
    success = "success"
    failed = "failed"
    upstream_failed = "upstream_failed"
    skipped = "skipped"
    cancelled = "cancelled"


class IncidentStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"
    ignored = "ignored"


class RootCauseCategory(str, enum.Enum):
    schema_drift = "schema_drift"
    data_quality = "data_quality"
    permissions = "permissions"
    resource_exhaustion = "resource_exhaustion"
    timeout = "timeout"
    dependency_failure = "dependency_failure"
    configuration = "configuration"
    code_error = "code_error"
    connectivity = "connectivity"
    concurrency = "concurrency"
    quota_limit = "quota_limit"
    upstream_data = "upstream_data"
    transient = "transient"
    unknown = "unknown"


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    connections: Mapped[list["Connection"]] = relationship(back_populates="workspace")


class Connection(Base):
    """A configured integration with a source platform."""

    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    platform: Mapped[PlatformType] = mapped_column(Enum(PlatformType))
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="connections")


class Pipeline(Base):
    """Canonical pipeline identity (Airflow DAG, dbt job, ADF pipeline...)."""

    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id"), index=True)
    platform: Mapped[PlatformType] = mapped_column(Enum(PlatformType))
    external_id: Mapped[str] = mapped_column(String(500), index=True)  # dag_id etc.
    name: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    runs: Mapped[list["Run"]] = relationship(back_populates="pipeline")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    external_run_id: Mapped[str] = mapped_column(String(500), index=True)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus))
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    trigger: Mapped[str] = mapped_column(String(100), default="scheduled")
    config_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    pipeline: Mapped["Pipeline"] = relationship(back_populates="runs")
    task_runs: Mapped[list["TaskRun"]] = relationship(back_populates="run")


class TaskRun(Base):
    """Node-level execution: Airflow task, dbt model, ADF activity..."""

    __tablename__ = "task_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    external_task_id: Mapped[str] = mapped_column(String(500))
    name: Mapped[str] = mapped_column(String(500))
    node_type: Mapped[str] = mapped_column(String(200), default="")  # operator/model type
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus))
    try_number: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    upstream_task_ids: Mapped[list] = mapped_column(JSON, default=list)

    run: Mapped["Run"] = relationship(back_populates="task_runs")
    log_bundles: Mapped[list["LogBundle"]] = relationship(back_populates="task_run")


class LogBundle(Base):
    """Redacted log text for a task attempt. Raw logs would live in blob
    storage in prod; for MVP we store redacted text inline."""

    __tablename__ = "log_bundles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    task_run_id: Mapped[str] = mapped_column(ForeignKey("task_runs.id"), index=True)
    content: Mapped[str] = mapped_column(Text)  # redacted
    redaction_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    task_run: Mapped["TaskRun"] = relationship(back_populates="log_bundles")


class Incident(Base):
    """One or more failed runs grouped by fingerprint — the unit of diagnosis."""

    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"))
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(500))
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.open
    )
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolution_notes: Mapped[str] = mapped_column(Text, default="")

    diagnoses: Mapped[list["Diagnosis"]] = relationship(back_populates="incident")
    feedback: Mapped[list["FeedbackEvent"]] = relationship(back_populates="incident")


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    root_cause_category: Mapped[RootCauseCategory] = mapped_column(
        Enum(RootCauseCategory), default=RootCauseCategory.unknown
    )
    root_cause_summary: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text, default="")  # plain English
    evidence: Mapped[list] = mapped_column(JSON, default=list)  # [{source, quote}]
    fixes: Mapped[list] = mapped_column(JSON, default=list)  # [{title, type, steps, diff, risk}]
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    is_transient: Mapped[bool] = mapped_column(default=False)
    engine: Mapped[str] = mapped_column(String(50), default="rules")  # rules | llm
    model_version: Mapped[str] = mapped_column(String(100), default="")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    incident: Mapped["Incident"] = relationship(back_populates="diagnoses")


class KnowledgeItem(Base):
    """KB entry: error pattern -> cause -> fix. workspace_id NULL = global."""

    __tablename__ = "knowledge_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    workspace_id: Mapped[str | None] = mapped_column(
        ForeignKey("workspaces.id"), nullable=True, index=True
    )
    platform: Mapped[PlatformType] = mapped_column(
        Enum(PlatformType), default=PlatformType.generic
    )
    pattern: Mapped[str] = mapped_column(Text)  # regex or keyword pattern
    title: Mapped[str] = mapped_column(String(500))
    cause: Mapped[str] = mapped_column(Text)
    fix: Mapped[str] = mapped_column(Text)
    category: Mapped[RootCauseCategory] = mapped_column(
        Enum(RootCauseCategory), default=RootCauseCategory.unknown
    )
    source: Mapped[str] = mapped_column(String(50), default="curated")  # curated | learned
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FeedbackEvent(Base):
    __tablename__ = "feedback_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), index=True)
    diagnosis_id: Mapped[str | None] = mapped_column(
        ForeignKey("diagnoses.id"), nullable=True
    )
    verdict: Mapped[str] = mapped_column(String(20))  # helpful | wrong | fixed_it
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    incident: Mapped["Incident"] = relationship(back_populates="feedback")
