"""Dashboard stats + pipelines listing."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Diagnosis, Incident, IncidentStatus, Pipeline, Run
from ..schemas import DashboardStats, IncidentSummary
from .incidents import _latest_diagnosis, _summary

router = APIRouter(prefix="/v1", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    incidents = db.query(Incident).all()

    by_category: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    confidences: list[float] = []
    for inc in incidents:
        diag = _latest_diagnosis(inc)
        if diag:
            by_category[diag.root_cause_category.value] = (
                by_category.get(diag.root_cause_category.value, 0) + 1
            )
            confidences.append(diag.confidence)
        pipeline = db.get(Pipeline, inc.pipeline_id)
        if pipeline:
            by_platform[pipeline.platform.value] = (
                by_platform.get(pipeline.platform.value, 0) + 1
            )

    recent = sorted(incidents, key=lambda i: i.last_seen_at, reverse=True)[:10]

    return DashboardStats(
        total_incidents=len(incidents),
        open_incidents=sum(1 for i in incidents if i.status == IncidentStatus.open),
        resolved_incidents=sum(1 for i in incidents if i.status == IncidentStatus.resolved),
        incidents_by_category=by_category,
        incidents_by_platform=by_platform,
        recent_incidents=[_summary(i, db.get(Pipeline, i.pipeline_id)) for i in recent],
        avg_confidence=round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
        recurring_incidents=sum(1 for i in incidents if i.occurrence_count > 1),
    )


@router.get("/pipelines")
def list_pipelines(db: Session = Depends(get_db)):
    from sqlalchemy import case

    from ..models import RunStatus

    rows = (
        db.query(
            Pipeline,
            func.count(Run.id).label("run_count"),
            func.sum(case((Run.status == RunStatus.failed, 1), else_=0)).label("failed_count"),
        )
        .outerjoin(Run, Run.pipeline_id == Pipeline.id)
        .group_by(Pipeline.id)
        .all()
    )
    return [
        {
            "id": p.id, "name": p.name, "platform": p.platform.value,
            "external_id": p.external_id, "run_count": int(run_count or 0),
            "failed_count": int(failed or 0),
        }
        for p, run_count, failed in rows
    ]
