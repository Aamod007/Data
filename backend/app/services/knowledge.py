"""Knowledge base: curated error patterns + learned tenant knowledge.

Retrieval is keyword/pattern based for MVP (works on SQLite); swap in
pgvector hybrid retrieval when on Postgres.
"""
import re

from sqlalchemy.orm import Session

from ..models import KnowledgeItem, PlatformType, RootCauseCategory as C

# Seed KB: (platform, pattern, title, cause, fix, category)
SEED_KNOWLEDGE: list[tuple[PlatformType, str, str, str, str, C]] = [
    (PlatformType.airflow,
     r"Task received SIGTERM",
     "Airflow task received SIGTERM",
     "The scheduler or executor killed the task — commonly from a timeout, a cluster scale-down evicting the pod, or a DAG redeploy mid-run.",
     "Check whether execution_timeout fired, whether the worker pod was evicted (node scale-down/preemption), and whether a deploy restarted workers mid-run. Make the task idempotent and enable retries.",
     C.transient),
    (PlatformType.airflow,
     r"Dag(?:bag)? import (error|timeout)|Failed to import",
     "DAG import failure",
     "The DAG file raised on import — syntax errors, missing imports, or slow top-level code exceeding the import timeout.",
     "Run `python dag_file.py` locally to reproduce. Move heavy work out of top-level DAG code. Pin the missing dependency in the workers' environment.",
     C.code_error),
    (PlatformType.airflow,
     r"(negsignal\.sigkill|Zombie task)",
     "Airflow zombie task / SIGKILL",
     "The worker running the task died without reporting status — usually OOM at the pod level or a lost worker.",
     "Check pod memory limits vs. usage (OOMKilled events), raise resources for this task, and tune the zombie detection interval.",
     C.resource_exhaustion),
    (PlatformType.dbt,
     r"Compilation Error.*(ref|source)\(",
     "dbt ref/source resolution failure",
     "A ref() or source() points at a model/source that doesn't exist — renamed model, missing package, or un-run `dbt deps`.",
     "Check the model/source name against manifest, run `dbt deps` if it's from a package, and grep for the old name after renames.",
     C.code_error),
    (PlatformType.dbt,
     r"on-run-(start|end).*failed",
     "dbt on-run hook failure",
     "A project-level hook failed before/after model execution — the models themselves may be fine.",
     "Inspect the hook SQL in dbt_project.yml; hooks often break on permissions or missing audit tables.",
     C.configuration),
    (PlatformType.snowflake,
     r"(000904|invalid identifier)",
     "Snowflake error 904: invalid identifier",
     "The query references a column Snowflake can't resolve — case-sensitivity from quoted identifiers is a classic cause besides genuine schema drift.",
     "Check for quoted identifiers created with lowercase names (\"my_col\" vs MY_COL). Compare against SELECT * FROM table LIMIT 0 output.",
     C.schema_drift),
    (PlatformType.snowflake,
     r"(000603|Internal error|incident)",
     "Snowflake internal error",
     "Snowflake-side incident — not your code.",
     "Retry; if persistent, check status.snowflake.com and open a support case with the query ID.",
     C.transient),
    (PlatformType.snowflake,
     r"Warehouse .* cannot be resumed|MONTHLY_USAGE_LIMIT|credit",
     "Snowflake warehouse suspended / credit limit",
     "The warehouse is suspended by a resource monitor that hit its credit quota.",
     "Check resource monitors (SHOW RESOURCE MONITORS), raise the quota or wait for reset, and investigate what consumed the credits.",
     C.quota_limit),
    (PlatformType.databricks,
     r"(Library installation failed|cannot be installed)",
     "Databricks library installation failure",
     "Cluster library install failed — version conflicts, missing repos, or init script errors.",
     "Check cluster event logs for the failing library, pin compatible versions, prefer cluster policies with preloaded images.",
     C.configuration),
    (PlatformType.databricks,
     r"(DRIVER_NOT_RESPONDING|Driver is up but is not responsive)",
     "Databricks driver unresponsive",
     "The driver is GC-thrashing or OOM — usually too much data pulled to the driver.",
     "Avoid collect()/display() on large data, increase driver memory, check for huge broadcast variables.",
     C.resource_exhaustion),
    (PlatformType.adf,
     r"(2200|UserErrorSourceBlobNotExist|not found in storage)",
     "ADF activity error 2200: source not found",
     "A Copy/Lookup activity's source dataset path doesn't exist for this run window.",
     "Verify the dataset path parameters for the failed window; check whether the upstream drop is late; add a Validation activity with a sensible timeout.",
     C.upstream_data),
    (PlatformType.adf,
     r"(IntegrationRuntime.*(offline|unavailable)|self-hosted.*IR)",
     "ADF integration runtime offline",
     "The self-hosted integration runtime node is offline or unreachable.",
     "Check the IR node's service status and connectivity; register a second node for HA.",
     C.connectivity),
    (PlatformType.generic,
     r"(SIGSEGV|core dumped|segmentation fault)",
     "Native crash (segfault)",
     "A native library crashed the process — often a version-incompatible wheel or corrupted install.",
     "Reinstall/pin native dependencies (e.g. pyarrow, numpy) to versions built for the runtime's platform; check for mixed glibc/musl images.",
     C.code_error),
]


def seed_kb(db: Session) -> int:
    """Insert seed knowledge if the KB is empty. Returns rows added."""
    if db.query(KnowledgeItem).filter(KnowledgeItem.source == "curated").count() > 0:
        return 0
    for platform, pattern, title, cause, fix, category in SEED_KNOWLEDGE:
        db.add(KnowledgeItem(
            workspace_id=None, platform=platform, pattern=pattern,
            title=title, cause=cause, fix=fix, category=category, source="curated",
        ))
    db.commit()
    return len(SEED_KNOWLEDGE)


def search_kb(db: Session, log: str, workspace_id: str | None,
              platform: PlatformType | None = None, limit: int = 5) -> list[KnowledgeItem]:
    """Match KB items whose pattern appears in the log. Tenant items are
    strictly scoped to the caller's workspace; global (NULL) items apply to all."""
    q = db.query(KnowledgeItem)
    if workspace_id:
        q = q.filter((KnowledgeItem.workspace_id.is_(None)) | (KnowledgeItem.workspace_id == workspace_id))
    else:
        q = q.filter(KnowledgeItem.workspace_id.is_(None))

    matches: list[tuple[int, KnowledgeItem]] = []
    for item in q.all():
        try:
            if re.search(item.pattern, log, re.IGNORECASE | re.DOTALL):
                # prefer tenant-learned and platform-specific matches
                score = 0
                if item.workspace_id:
                    score += 2
                if platform and item.platform == platform:
                    score += 1
                matches.append((score, item))
        except re.error:
            continue
    matches.sort(key=lambda t: t[0], reverse=True)
    return [item for _, item in matches[:limit]]


def learn_from_incident(db: Session, workspace_id: str, platform: PlatformType,
                        error_signature_pattern: str, title: str,
                        cause: str, fix: str, category: C) -> KnowledgeItem:
    """Promote a confirmed resolution into the tenant's KB (the learning loop)."""
    item = KnowledgeItem(
        workspace_id=workspace_id, platform=platform,
        pattern=error_signature_pattern, title=title,
        cause=cause, fix=fix, category=category, source="learned",
    )
    db.add(item)
    db.commit()
    return item
