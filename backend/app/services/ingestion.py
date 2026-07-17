"""Ingestion orchestration: RunEventIn -> stored CPEM entities -> incident
(deduplicated by fingerprint) -> diagnosis.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import (
    Connection,
    Diagnosis,
    Incident,
    IncidentStatus,
    LogBundle,
    Pipeline,
    Run,
    RunStatus,
    TaskRun,
)
from ..schemas import RunEventIn
from . import knowledge
from .diagnosis import diagnose
from .fingerprint import fingerprint
from .redaction import redact


def _naive_utc(dt: datetime | None) -> datetime | None:
    """SQLite loses tzinfo; store everything as naive UTC consistently."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _get_or_create_pipeline(db: Session, workspace_id: str, connection: Connection,
                            event: RunEventIn) -> Pipeline:
    pipeline = (
        db.query(Pipeline)
        .filter(
            Pipeline.workspace_id == workspace_id,
            Pipeline.platform == event.platform,
            Pipeline.external_id == event.pipeline_external_id,
        )
        .first()
    )
    if pipeline is None:
        pipeline = Pipeline(
            workspace_id=workspace_id,
            connection_id=connection.id,
            platform=event.platform,
            external_id=event.pipeline_external_id,
            name=event.pipeline_name or event.pipeline_external_id,
        )
        db.add(pipeline)
        db.flush()
    return pipeline


def ingest_run_event(db: Session, workspace_id: str, connection: Connection,
                     event: RunEventIn) -> tuple[Run, Incident | None, bool]:
    """Persist the run; if it failed, create/update an incident and diagnose it.

    Returns (run, incident-or-None, deduplicated).
    """
    pipeline = _get_or_create_pipeline(db, workspace_id, connection, event)

    run = Run(
        pipeline_id=pipeline.id,
        external_run_id=event.run_external_id,
        status=event.status,
        started_at=_naive_utc(event.started_at),
        ended_at=_naive_utc(event.ended_at),
        trigger=event.trigger,
        config_snapshot=event.config_snapshot,
    )
    db.add(run)
    db.flush()

    failed_task_logs: list[tuple[TaskRun, str]] = []  # (task_run, redacted_log)
    for t in event.tasks:
        task_run = TaskRun(
            run_id=run.id,
            external_task_id=t.task_id,
            name=t.name or t.task_id,
            node_type=t.node_type,
            status=t.status,
            try_number=t.try_number,
            started_at=_naive_utc(t.started_at),
            ended_at=_naive_utc(t.ended_at),
            upstream_task_ids=t.upstream_task_ids,
        )
        db.add(task_run)
        db.flush()

        if t.log:
            redacted, n_redactions = redact(t.log)
            db.add(LogBundle(
                task_run_id=task_run.id,
                content=redacted,
                redaction_count=n_redactions,
            ))
            if t.status in (RunStatus.failed, RunStatus.upstream_failed):
                failed_task_logs.append((task_run, redacted))

    incident: Incident | None = None
    deduplicated = False

    if event.status == RunStatus.failed:
        # Root-cause task = first genuinely failed task (not upstream_failed
        # casualties); fall back to any failed log, then to a synthetic log.
        root = next(
            ((tr, lg) for tr, lg in failed_task_logs if tr.status == RunStatus.failed),
            failed_task_logs[0] if failed_task_logs else None,
        )
        if root:
            failed_task, log_text = root
        else:
            failed_task, log_text = None, f"Run {event.run_external_id} of pipeline {event.pipeline_external_id} failed with no task logs provided."

        fp = fingerprint(log_text, event.pipeline_external_id,
                         failed_task.node_type if failed_task else "")

        existing = (
            db.query(Incident)
            .filter(
                Incident.workspace_id == workspace_id,
                Incident.fingerprint == fp,
                Incident.status.in_([IncidentStatus.open, IncidentStatus.acknowledged]),
            )
            .first()
        )
        if existing:
            existing.occurrence_count += 1
            existing.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)
            existing.run_id = run.id
            incident, deduplicated = existing, True
        else:
            # Recurrence context from previously RESOLVED incidents with the
            # same fingerprint — "we've seen and fixed this before".
            prior_resolved = (
                db.query(Incident)
                .filter(
                    Incident.workspace_id == workspace_id,
                    Incident.fingerprint == fp,
                    Incident.status == IncidentStatus.resolved,
                )
                .order_by(Incident.resolved_at.desc())
                .first()
            )
            recurrence_note = ""
            if prior_resolved:
                recurrence_note = (
                    f"This exact failure signature was seen before "
                    f"({prior_resolved.occurrence_count} occurrence(s)) and resolved on "
                    f"{prior_resolved.resolved_at:%Y-%m-%d}."
                )
                if prior_resolved.resolution_notes:
                    recurrence_note += f" Prior resolution notes: {prior_resolved.resolution_notes}"

            task_label = failed_task.name if failed_task else "run"
            incident = Incident(
                workspace_id=workspace_id,
                pipeline_id=pipeline.id,
                run_id=run.id,
                fingerprint=fp,
                title=f"{pipeline.name}: {task_label} failed",
            )
            db.add(incident)
            pipeline_name = pipeline.name
            task_name = failed_task.name if failed_task else ""
            node_type = failed_task.node_type if failed_task else ""

            kb_items = knowledge.search_kb(db, log_text, workspace_id, event.platform)

            # Commit BEFORE the (potentially seconds-long) LLM call: the run and
            # incident are durable, and the SQLite write lock is not held across
            # network I/O. A diagnose() failure then can't discard the ingest.
            # Note: dedup is still check-then-insert; the race window is now
            # milliseconds — add a unique index on (workspace_id, fingerprint)
            # once a migration story (Alembic) exists.
            db.commit()

            result = diagnose(
                log=log_text,
                platform=event.platform,
                pipeline_name=pipeline_name,
                task_name=task_name,
                node_type=node_type,
                kb_items=kb_items,
                recurrence_note=recurrence_note,
            )
            db.add(Diagnosis(
                incident_id=incident.id,
                root_cause_category=result.root_cause_category,
                root_cause_summary=result.root_cause_summary,
                explanation=result.explanation,
                evidence=result.evidence,
                fixes=result.fixes,
                confidence=result.confidence,
                is_transient=result.is_transient,
                engine=result.engine,
                model_version=result.model_version,
                latency_ms=result.latency_ms,
            ))
            # Better incident title once diagnosed
            if result.root_cause_summary:
                summary = result.root_cause_summary.removeprefix("[Hypothesis] ")
                incident.title = f"{pipeline_name}: {summary[:180]}"

    db.commit()
    return run, incident, deduplicated
