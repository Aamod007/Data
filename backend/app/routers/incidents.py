"""Incidents API: list, detail, status updates, feedback (learning loop)."""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Diagnosis,
    FeedbackEvent,
    Incident,
    IncidentStatus,
    LogBundle,
    Pipeline,
    PlatformType,
    RootCauseCategory,
    TaskRun,
)
from ..schemas import (
    DiagnosisOut,
    FeedbackIn,
    IncidentDetail,
    IncidentStatusUpdate,
    IncidentSummary,
)
from ..services import knowledge

router = APIRouter(prefix="/v1/incidents", tags=["incidents"])


def _latest_diagnosis(incident: Incident) -> Diagnosis | None:
    return max(incident.diagnoses, key=lambda d: d.created_at, default=None)


def _summary(incident: Incident, pipeline: Pipeline | None) -> IncidentSummary:
    diag = _latest_diagnosis(incident)
    return IncidentSummary(
        id=incident.id,
        pipeline_id=incident.pipeline_id,
        pipeline_name=pipeline.name if pipeline else "",
        platform=pipeline.platform if pipeline else None,
        title=incident.title,
        status=incident.status,
        fingerprint=incident.fingerprint,
        occurrence_count=incident.occurrence_count,
        first_seen_at=incident.first_seen_at,
        last_seen_at=incident.last_seen_at,
        root_cause_category=diag.root_cause_category if diag else None,
        root_cause_summary=diag.root_cause_summary if diag else "",
        confidence=diag.confidence if diag else None,
    )


@router.get("", response_model=list[IncidentSummary])
def list_incidents(
    status: IncidentStatus | None = None,
    category: RootCauseCategory | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Incident).order_by(Incident.last_seen_at.desc())
    if status:
        q = q.filter(Incident.status == status)
    if category:
        # Filter in SQL so pagination applies to the filtered set — filtering
        # after offset/limit returns incomplete or empty pages.
        q = (
            q.join(Diagnosis, Diagnosis.incident_id == Incident.id)
            .filter(Diagnosis.root_cause_category == category)
            .distinct()
        )
    incidents = q.offset(offset).limit(limit).all()

    return [_summary(inc, db.get(Pipeline, inc.pipeline_id)) for inc in incidents]


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    pipeline = db.get(Pipeline, incident.pipeline_id)

    # logs of failed tasks in the incident's run
    logs = (
        db.query(TaskRun, LogBundle)
        .join(LogBundle, LogBundle.task_run_id == TaskRun.id)
        .filter(TaskRun.run_id == incident.run_id)
        .all()
    )
    base = _summary(incident, pipeline)
    return IncidentDetail(
        **base.model_dump(),
        run_id=incident.run_id,
        resolution_notes=incident.resolution_notes,
        diagnoses=[DiagnosisOut.model_validate(d) for d in
                   sorted(incident.diagnoses, key=lambda d: d.created_at, reverse=True)],
        logs=[{"task": tr.name, "content": lb.content,
               "redactions": lb.redaction_count} for tr, lb in logs],
    )


@router.patch("/{incident_id}/status", response_model=IncidentSummary)
def update_status(incident_id: str, body: IncidentStatusUpdate,
                  db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = body.status
    if body.resolution_notes:
        incident.resolution_notes = body.resolution_notes
    if body.status == IncidentStatus.resolved:
        incident.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return _summary(incident, db.get(Pipeline, incident.pipeline_id))


@router.post("/{incident_id}/feedback", status_code=201)
def submit_feedback(incident_id: str, body: FeedbackIn, db: Session = Depends(get_db)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if body.verdict not in ("helpful", "wrong", "fixed_it"):
        raise HTTPException(status_code=422, detail="verdict must be helpful|wrong|fixed_it")

    diag = _latest_diagnosis(incident)
    db.add(FeedbackEvent(
        incident_id=incident.id,
        diagnosis_id=diag.id if diag else None,
        verdict=body.verdict,
        comment=body.comment,
    ))

    # Learning loop: a confirmed fix becomes tenant knowledge so the next
    # occurrence is diagnosed instantly with the proven resolution.
    if body.verdict == "fixed_it" and diag is not None:
        pipeline = db.get(Pipeline, incident.pipeline_id)
        first_quote = diag.evidence[0]["quote"] if diag.evidence else ""
        if first_quote:
            knowledge.learn_from_incident(
                db,
                workspace_id=incident.workspace_id,
                platform=pipeline.platform if pipeline else PlatformType.generic,
                error_signature_pattern=re.escape(first_quote[:300]),
                title=incident.title,
                cause=diag.root_cause_summary,
                fix=body.comment or (diag.fixes[0]["title"] if diag.fixes else "See prior incident"),
                category=diag.root_cause_category,
            )
    db.commit()
    return {"ok": True}
