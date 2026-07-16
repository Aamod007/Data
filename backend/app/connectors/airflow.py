"""Airflow connector: normalize Airflow failure-callback / API payloads into
the canonical RunEventIn.

Expected payload shape (emitted by our Airflow callback plugin, or assembled
from the stable REST API):
{
  "dag_id": "daily_sales",
  "dag_run_id": "scheduled__2026-07-16T02:00:00",
  "state": "failed",
  "execution_date": "...",
  "start_date": "...", "end_date": "...",
  "run_type": "scheduled",
  "conf": {...},
  "task_instances": [
    {"task_id": "load_orders", "operator": "PythonOperator", "state": "failed",
     "try_number": 2, "start_date": "...", "end_date": "...",
     "upstream_task_ids": ["extract_orders"], "log": "..."}
  ]
}
"""
from datetime import datetime

from ..models import PlatformType, RunStatus
from ..schemas import RunEventIn, TaskEventIn

_STATE_MAP = {
    "success": RunStatus.success,
    "failed": RunStatus.failed,
    "running": RunStatus.running,
    "upstream_failed": RunStatus.upstream_failed,
    "skipped": RunStatus.skipped,
    "removed": RunStatus.skipped,
    "shutdown": RunStatus.cancelled,
    "queued": RunStatus.running,
}


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize(payload: dict) -> RunEventIn:
    tasks = [
        TaskEventIn(
            task_id=ti.get("task_id", "unknown"),
            name=ti.get("task_id", "unknown"),
            node_type=ti.get("operator", ""),
            status=_STATE_MAP.get(str(ti.get("state", "")).lower(), RunStatus.failed),
            try_number=int(ti.get("try_number", 1)),
            started_at=_dt(ti.get("start_date")),
            ended_at=_dt(ti.get("end_date")),
            upstream_task_ids=ti.get("upstream_task_ids", []),
            log=ti.get("log", ""),
        )
        for ti in payload.get("task_instances", [])
    ]
    return RunEventIn(
        platform=PlatformType.airflow,
        pipeline_external_id=payload["dag_id"],
        pipeline_name=payload.get("dag_display_name") or payload["dag_id"],
        run_external_id=payload.get("dag_run_id") or payload.get("run_id", "unknown"),
        status=_STATE_MAP.get(str(payload.get("state", "")).lower(), RunStatus.failed),
        trigger=payload.get("run_type", "scheduled"),
        started_at=_dt(payload.get("start_date")),
        ended_at=_dt(payload.get("end_date")),
        config_snapshot=payload.get("conf") or {},
        tasks=tasks,
    )
