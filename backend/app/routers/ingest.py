"""Ingestion endpoints: platform webhooks + generic CPEM + ad-hoc diagnosis."""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Connection, PlatformType, Workspace
from ..schemas import AdhocDiagnoseIn, DiagnosisOut, IngestAck, RunEventIn
from ..connectors import airflow as airflow_connector
from ..connectors import dbt as dbt_connector
from ..services import knowledge
from ..services.diagnosis import diagnose
from ..services.ingestion import ingest_run_event
from ..services.redaction import redact

router = APIRouter(prefix="/v1", tags=["ingest"])


def require_ingest_auth(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if settings.ingest_api_key and not (
        x_api_key and secrets.compare_digest(x_api_key, settings.ingest_api_key)
    ):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def _default_workspace(db: Session) -> Workspace:
    ws = db.query(Workspace).first()
    if ws is None:
        ws = Workspace(name="Default Workspace")
        db.add(ws)
        db.commit()
    return ws


def _get_or_create_connection(db: Session, workspace_id: str,
                              platform: PlatformType) -> Connection:
    conn = (
        db.query(Connection)
        .filter(Connection.workspace_id == workspace_id, Connection.platform == platform)
        .first()
    )
    if conn is None:
        conn = Connection(workspace_id=workspace_id, platform=platform,
                          name=f"{platform.value} (auto-created)")
        db.add(conn)
        db.flush()
    return conn


def _ingest(db: Session, event: RunEventIn) -> IngestAck:
    ws = _default_workspace(db)
    conn = _get_or_create_connection(db, ws.id, event.platform)
    run, incident, deduplicated = ingest_run_event(db, ws.id, conn, event)
    return IngestAck(
        run_id=run.id,
        incident_id=incident.id if incident else None,
        deduplicated=deduplicated,
    )


@router.post("/ingest/event", response_model=IngestAck,
             dependencies=[Depends(require_ingest_auth)])
def ingest_generic(event: RunEventIn, db: Session = Depends(get_db)):
    """Generic CPEM ingestion — any platform can post the canonical shape."""
    return _ingest(db, event)


@router.post("/ingest/airflow", response_model=IngestAck,
             dependencies=[Depends(require_ingest_auth)])
def ingest_airflow(payload: dict, db: Session = Depends(get_db)):
    try:
        event = airflow_connector.normalize(payload)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Malformed Airflow payload: {e}")
    return _ingest(db, event)


@router.post("/ingest/dbt", response_model=IngestAck,
             dependencies=[Depends(require_ingest_auth)])
def ingest_dbt(payload: dict, db: Session = Depends(get_db)):
    try:
        event = dbt_connector.normalize(payload)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Malformed dbt payload: {e}")
    return _ingest(db, event)


@router.post("/diagnose", response_model=DiagnosisOut)
def adhoc_diagnose(body: AdhocDiagnoseIn, db: Session = Depends(get_db)):
    """Paste a log, get a diagnosis. No connection required — the PLG hook."""
    if not body.log.strip():
        raise HTTPException(status_code=422, detail="log must not be empty")
    redacted, _ = redact(body.log)
    kb_items = knowledge.search_kb(db, redacted, workspace_id=None, platform=body.platform)
    result = diagnose(
        log=redacted,
        platform=body.platform,
        extra_context=body.context,
        kb_items=kb_items,
    )
    return DiagnosisOut(
        id="adhoc",
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
        created_at=datetime.now(timezone.utc),
    )
