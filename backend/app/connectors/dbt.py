"""dbt connector: normalize dbt run_results.json (Core artifact or Cloud API
payload) into the canonical RunEventIn.

Accepts:
{
  "project_name": "analytics",          # optional wrapper fields
  "job_id": "123", "run_id": "456",
  "run_results": { ...run_results.json contents... }
}
or a bare run_results.json (metadata.invocation_id used as run id).
"""
from datetime import datetime

from ..models import PlatformType, RunStatus
from ..schemas import RunEventIn, TaskEventIn

_STATUS_MAP = {
    "success": RunStatus.success,
    "pass": RunStatus.success,
    "error": RunStatus.failed,
    "fail": RunStatus.failed,
    "runtime error": RunStatus.failed,
    "skipped": RunStatus.skipped,
    "warn": RunStatus.success,
}


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize(payload: dict) -> RunEventIn:
    run_results = payload.get("run_results", payload)
    metadata = run_results.get("metadata", {})
    results = run_results.get("results", [])

    tasks: list[TaskEventIn] = []
    any_failed = False
    for r in results:
        status = _STATUS_MAP.get(str(r.get("status", "")).lower(), RunStatus.failed)
        if status == RunStatus.failed:
            any_failed = True
        unique_id = r.get("unique_id", "unknown")
        node_type = unique_id.split(".")[0] if "." in unique_id else "model"  # model/test/seed/snapshot

        timing = {t.get("name"): t for t in r.get("timing", [])}
        execute = timing.get("execute", {})

        # For failures, the message contains the database error — that's our log.
        log = ""
        if status == RunStatus.failed:
            log = str(r.get("message") or "")
            compiled = r.get("compiled_code") or r.get("compiled_sql") or ""
            if compiled:
                log += "\n\n--- compiled SQL ---\n" + compiled[:8000]

        tasks.append(TaskEventIn(
            task_id=unique_id,
            name=unique_id.split(".")[-1],
            node_type=node_type,
            status=status,
            started_at=_dt(execute.get("started_at")),
            ended_at=_dt(execute.get("completed_at")),
            log=log,
        ))

    project = payload.get("project_name") or metadata.get("project_name") or "dbt-project"
    run_id = str(payload.get("run_id") or metadata.get("invocation_id") or "unknown")

    return RunEventIn(
        platform=PlatformType.dbt,
        pipeline_external_id=str(payload.get("job_id") or project),
        pipeline_name=project,
        run_external_id=run_id,
        status=RunStatus.failed if any_failed else RunStatus.success,
        trigger="scheduled",
        started_at=_dt(metadata.get("generated_at")),
        ended_at=_dt(metadata.get("generated_at")),
        config_snapshot={"dbt_version": metadata.get("dbt_version", "")},
        tasks=tasks,
    )
