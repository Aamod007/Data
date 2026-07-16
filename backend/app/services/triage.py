"""Rule-based triage: deterministic classification of well-known failure
patterns. Fast path that runs before (and as fallback for) the LLM engine.

Each rule: pattern -> (category, title, cause, fixes, is_transient).
Ordered by specificity — first match wins.
"""
import re
from dataclasses import dataclass, field

from ..models import RootCauseCategory as C


@dataclass
class RuleMatch:
    category: C
    title: str
    cause: str
    explanation: str
    fixes: list[dict] = field(default_factory=list)
    is_transient: bool = False
    confidence: float = 0.75
    matched_quote: str = ""


@dataclass
class _Rule:
    pattern: re.Pattern
    category: C
    title: str
    cause: str
    explanation: str
    fixes: list[dict]
    is_transient: bool = False
    confidence: float = 0.75


def _fix(title: str, type_: str = "manual", steps: list[str] | None = None, risk: str = "low") -> dict:
    return {"title": title, "type": type_, "steps": steps or [], "diff": "", "risk": risk}


_RULES: list[_Rule] = [
    # ---- Resource exhaustion ----
    _Rule(
        re.compile(r"(?i)(java\.lang\.OutOfMemoryError|OutOfMemoryError|OOMKilled|MemoryError|Container killed .* memory|exit code 137|SIGKILL.*memory)"),
        C.resource_exhaustion,
        "Task ran out of memory",
        "The process exceeded its memory allocation and was killed.",
        "The task attempted to hold more data in memory than the executor/container was allocated. "
        "This typically happens when data volume grows, a join explodes row counts, or a collect/to-pandas "
        "pulls a large dataset onto a single node.",
        [
            _fix("Increase memory allocation for this task", "config_change",
                 ["Raise executor/container memory (e.g. Spark executor_memory, K8s resources.limits.memory)",
                  "For Airflow on K8s, increase the pod resource request in the task's executor_config"]),
            _fix("Reduce memory footprint", "code_change",
                 ["Avoid collect()/toPandas() on large datasets",
                  "Repartition or process data in chunks",
                  "Check for join key skew causing one partition to balloon"]),
        ],
        confidence=0.9,
    ),
    _Rule(
        re.compile(r"(?i)(No space left on device|Disk quota exceeded|DiskFull|out of disk)"),
        C.resource_exhaustion,
        "Out of disk space",
        "The worker or warehouse ran out of local disk.",
        "The task filled the available disk — commonly from large shuffle spills, temp files, or unrotated logs.",
        [_fix("Free or expand disk", "config_change",
              ["Increase worker disk size or use a larger instance type",
               "Clean temp directories and enable log rotation",
               "For Spark: reduce shuffle spill by tuning partitions"])],
        confidence=0.9,
    ),
    # ---- Permissions ----
    _Rule(
        re.compile(r"(?i)(permission denied|access denied|not authorized|unauthorized|403 Forbidden|insufficient privileges|AuthorizationFailed|AccessDeniedException)"),
        C.permissions,
        "Permission / authorization failure",
        "The identity running this task lacks a required privilege.",
        "The credentials used by the pipeline do not have permission for an object or operation it tried to access. "
        "This often appears after credential rotation, a new object being created without grants, or an IAM/role policy change.",
        [
            _fix("Grant the missing privilege", "config_change",
                 ["Identify the object and operation from the error line",
                  "Grant the role/service principal the required privilege (e.g. GRANT SELECT ON ... TO ROLE ...)",
                  "Check whether credentials were recently rotated or the role changed"]),
        ],
        confidence=0.88,
    ),
    _Rule(
        re.compile(r"(?i)(authentication failed|invalid credentials|login failed|401 Unauthorized|token expired|expired.{0,20}(token|credential|password)|Incorrect username or password)"),
        C.permissions,
        "Authentication failure — invalid or expired credentials",
        "The connection's credentials are invalid or expired.",
        "The platform rejected the login itself (before any authorization check). Most common causes: an expired "
        "token/password, a rotated secret not updated in the connection, or a deactivated service account.",
        [_fix("Update the stored credentials", "config_change",
              ["Verify the secret in your secret manager / connection config matches the current credential",
               "Re-issue the token or reset the service account password",
               "Confirm the account is not locked or deactivated"])],
        confidence=0.88,
    ),
    # ---- Schema drift ----
    _Rule(
        re.compile(r"(?i)(column .{1,80}(does not exist|not found|no such column)|invalid identifier|Unrecognized name|no viable alternative at input|cannot resolve '?\[?`?\w+`?\]?'? given input columns)"),
        C.schema_drift,
        "Referenced column missing — likely schema drift",
        "A column referenced by the query no longer exists (or was renamed) in the source.",
        "The query references a column the database can't find. Usually an upstream schema change: the column was "
        "renamed, dropped, or the model now reads a different relation. Check recent DDL or upstream model changes.",
        [
            _fix("Reconcile the schema", "sql_patch",
                 ["Compare the failing query's columns against the current source schema",
                  "If the column was renamed upstream, update the reference (or add a compatibility alias upstream)",
                  "Add a schema test / contract on the source to catch this pre-deployment"]),
        ],
        confidence=0.87,
    ),
    _Rule(
        re.compile(r"(?i)((table|relation|object|view) .{1,100}(does not exist|not found)|no such table|Table or view not found|Invalid object name)"),
        C.schema_drift,
        "Referenced table/relation missing",
        "A table or view referenced by the task does not exist in the target database.",
        "The relation may have been dropped, renamed, or never created because an upstream job that builds it failed "
        "or hasn't run yet. It can also indicate a wrong database/schema in the connection profile.",
        [
            _fix("Verify the upstream producer ran", "manual",
                 ["Check whether the job that creates this relation succeeded recently",
                  "Confirm database/schema names in the profile/connection match the environment",
                  "If renamed, update refs/sources accordingly"]),
        ],
        confidence=0.85,
    ),
    _Rule(
        re.compile(r"(?i)(datatype mismatch|cannot cast|type mismatch|incompatible types|Conversion failed when converting|invalid input syntax for type|Numeric value .{1,40} is not recognized)"),
        C.schema_drift,
        "Data type mismatch",
        "A value could not be converted to the expected data type.",
        "Incoming data no longer matches the expected type — e.g. text appearing in a numeric column, a date format "
        "change, or an upstream type widening. Often accompanies a silent upstream schema or format change.",
        [_fix("Add explicit casting / fix upstream type", "sql_patch",
              ["Identify the offending column and sample the bad values",
               "Add TRY_CAST/safe casting with rejection handling, or fix the upstream type",
               "Add a data test on the column's format"])],
        confidence=0.82,
    ),
    # ---- Timeouts / connectivity ----
    _Rule(
        re.compile(r"(?i)(deadlock detected|Deadlock found|lock wait timeout|could not obtain lock|Transaction .{0,40} was deadlocked)"),
        C.concurrency,
        "Lock contention / deadlock",
        "The task's transaction collided with another concurrent transaction.",
        "Two or more processes tried to modify the same objects simultaneously. Common when a pipeline overlaps its "
        "own previous run, or two jobs write the same table.",
        [_fix("Serialize the conflicting writers", "config_change",
              ["Identify the other transaction from the lock/deadlock message",
               "Prevent run overlap (e.g. Airflow max_active_runs=1, dbt job concurrency)",
               "Consider splitting shared-table writes or using shorter transactions"]),
         _fix("Retry the run", "retry", ["Deadlocks are usually transient — re-run the task"], "low")],
        is_transient=True,
        confidence=0.85,
    ),
    _Rule(
        re.compile(r"(?i)(query.{0,30}(cancelled|canceled).{0,40}timeout|statement timeout|execution.{0,20}timed out|SQLTimeoutException|timeout expired|task timed out|AirflowTaskTimeout|exceeded.{0,30}timeout)"),
        C.timeout,
        "Operation timed out",
        "The task exceeded its configured time limit.",
        "The operation ran longer than allowed. Either the workload grew (more data, a slower plan, warehouse "
        "queueing) or the timeout is set too tight for the workload.",
        [
            _fix("Investigate the slowdown before raising timeouts", "manual",
                 ["Compare this run's duration to the historical baseline",
                  "Check for warehouse queueing / cluster contention at run time",
                  "Look for a changed query plan (missing pruning, exploded join)"]),
            _fix("Raise the timeout if the workload legitimately grew", "config_change",
                 ["Increase task execution_timeout / statement timeout to fit the new baseline"]),
        ],
        confidence=0.8,
    ),
    _Rule(
        re.compile(r"(?i)(connection (refused|reset|aborted|timed out)|could not connect|ConnectionError|EndpointConnectionError|Name or service not known|getaddrinfo failed|Temporary failure in name resolution|Network is unreachable|SSL.{0,30}(error|failed)|host.{0,20}unreachable)"),
        C.connectivity,
        "Network / connectivity failure",
        "The task could not reach a remote service.",
        "A network-level failure occurred: DNS resolution, TCP connect, TLS handshake, or an abruptly closed "
        "connection. Frequently transient, but persistent recurrence points to firewall/DNS/endpoint config changes.",
        [
            _fix("Retry the run", "retry", ["Single occurrences are usually transient"], "low"),
            _fix("Check endpoint & network path if it recurs", "manual",
                 ["Verify the hostname/endpoint is correct and resolvable from the worker",
                  "Check firewall rules, private endpoints, and IP allowlists",
                  "Check the remote service's status page for an outage window"]),
        ],
        is_transient=True,
        confidence=0.78,
    ),
    # ---- Quotas / limits ----
    _Rule(
        re.compile(r"(?i)(rate limit|429 Too Many Requests|quota exceeded|ThrottlingException|Request was throttled|concurrency limit|too many concurrent|resource .{0,30}exhausted.{0,30}quota)"),
        C.quota_limit,
        "Rate limit / quota exceeded",
        "The task hit an API rate limit or a platform quota.",
        "The platform throttled or rejected requests because a limit was reached — API rate limits, warehouse "
        "concurrency slots, or account-level quotas. Often triggered by many jobs starting simultaneously.",
        [
            _fix("Add backoff and stagger schedules", "config_change",
                 ["Enable exponential backoff/retry on the client",
                  "Stagger job start times to avoid thundering-herd at :00",
                  "Request a quota increase if usage legitimately grew"]),
        ],
        is_transient=True,
        confidence=0.85,
    ),
    # ---- Data quality ----
    _Rule(
        re.compile(r"(?i)(NOT NULL constraint|null value in column|violates (not-null|unique|foreign key|check) constraint|duplicate key value|unique constraint.{0,40}(violated|failed)|Duplicate entry)"),
        C.data_quality,
        "Constraint violation — bad data reached the load",
        "Incoming data violated a NOT NULL / unique / FK constraint.",
        "The load tried to write rows that break a database constraint: unexpected nulls, duplicate keys, or "
        "orphaned references. The root cause is almost always upstream data, not the load itself.",
        [_fix("Quarantine and trace the bad rows", "manual",
              ["Sample the violating rows from the error / staging table",
               "Trace where the nulls/duplicates originate upstream",
               "Add a pre-load data test so this fails earlier with a clearer message"])],
        confidence=0.85,
    ),
    _Rule(
        re.compile(r"(?i)(dbt.{0,40}test.{0,20}fail|FAIL \d+ |assertion failed|data quality check failed|expectation.{0,30}failed|Great Expectations.{0,30}failed)"),
        C.data_quality,
        "Data quality test failed",
        "A data test/assertion detected bad data.",
        "A quality gate did its job: the data violated an expectation (nulls, duplicates, referential breaks, "
        "distribution shifts). The pipeline code is likely fine — the data changed.",
        [_fix("Inspect the failing test's rows", "manual",
              ["Run the test's compiled SQL to see offending rows",
               "Determine whether it's a true data issue or a stale expectation",
               "Fix upstream or update the test threshold deliberately"])],
        confidence=0.85,
    ),
    # ---- Files / upstream data ----
    _Rule(
        re.compile(r"(?i)(FileNotFoundError|No such file or directory|BlobNotFound|NoSuchKey|404.{0,30}(blob|key|file)|Path does not exist|The specified (blob|key) does not exist)"),
        C.upstream_data,
        "Expected file/blob not found",
        "An input file the task expected is missing.",
        "The task looked for a file/blob that isn't there. Typical causes: an upstream export is late or failed, a "
        "date-partitioned path was computed for a period with no data, or the naming convention changed.",
        [_fix("Check the upstream producer and path logic", "manual",
              ["Verify whether the upstream export/job for this period ran",
               "Check the exact computed path vs. what exists in storage",
               "Consider a sensor/existence check with a clear alert instead of a hard failure"])],
        confidence=0.82,
    ),
    # ---- Code errors ----
    _Rule(
        re.compile(r"(?i)(ModuleNotFoundError|ImportError: (cannot import|No module)|ClassNotFoundException|NoClassDefFoundError|package .{1,60} (is not installed|not found))"),
        C.configuration,
        "Missing dependency / import failure",
        "A required library or module is not installed in the runtime environment.",
        "The code imports a package the execution environment doesn't have. Common after image/environment changes, "
        "unpinned dependency upgrades, or running on a new worker pool.",
        [_fix("Install/pin the missing dependency", "config_change",
              ["Add the package to the environment (requirements/image/cluster libraries)",
               "Pin versions to prevent silent upgrades",
               "Rebuild and redeploy the runtime image"])],
        confidence=0.9,
    ),
    _Rule(
        re.compile(r"(?i)(syntax error|SyntaxError|ParseException|SQL compilation error|unexpected token|mismatched input)"),
        C.code_error,
        "Syntax / compilation error",
        "The code or SQL failed to parse.",
        "The statement is malformed — usually from a recent code change, an unrendered template variable, or "
        "dialect differences after a platform migration.",
        [_fix("Fix the syntax at the reported position", "code_change",
              ["Locate the line/position in the error message",
               "Check for unrendered Jinja/template variables in compiled SQL",
               "Diff against the last successful run's code version"])],
        confidence=0.85,
    ),
    _Rule(
        re.compile(r"(?i)(division by zero|ZeroDivisionError|KeyError|IndexError|AttributeError|TypeError:|NullPointerException|ValueError:)"),
        C.code_error,
        "Runtime code exception",
        "The task's code raised an unhandled exception.",
        "An unhandled exception in task code. If this code was recently deployed, suspect the change; if untouched, "
        "suspect a data shape it has never seen before (empty input, missing key, unexpected null).",
        [_fix("Reproduce with the failing input", "code_change",
              ["Read the traceback's last frames to find the failing expression",
               "Check what changed: the code (recent deploy) or the data (new edge case)",
               "Add handling/validation for the edge case"])],
        confidence=0.7,
    ),
    # ---- Upstream orchestration ----
    _Rule(
        re.compile(r"(?i)(upstream_failed|upstream task.{0,30}failed|dependency.{0,30}(failed|not met)|Skipping.{0,40}upstream)"),
        C.dependency_failure,
        "Failed because an upstream task failed",
        "This task never got a chance — its upstream dependency failed first.",
        "This is a downstream casualty, not the root cause. Diagnose the earliest failed task in the run instead.",
        [_fix("Diagnose the upstream failure", "manual",
              ["Find the first failed task in this run — that's the real incident",
               "Once fixed, clear/rerun from the failed task"])],
        confidence=0.9,
    ),
    # ---- Spark-specific ----
    _Rule(
        re.compile(r"(?i)(FetchFailedException|shuffle.{0,30}(failed|fetch)|ExecutorLostFailure|Executor heartbeat timed out|Lost executor)"),
        C.resource_exhaustion,
        "Spark executor/shuffle failure",
        "Executors died or shuffle data was lost mid-job.",
        "Executors were lost during the job — typically memory pressure (silent OOM kills), spot/preemptible "
        "instance reclamation, or severe data skew concentrating load on a few executors.",
        [
            _fix("Stabilize the executors", "config_change",
                 ["Increase executor memory / memory overhead",
                  "If on spot instances, enable decommissioning or use on-demand for this job",
                  "Check the Spark UI for skewed partitions; salt the join key if skewed"]),
        ],
        confidence=0.82,
    ),
]


def classify(log: str) -> RuleMatch | None:
    """Return the first matching rule, or None if nothing matched."""
    for rule in _RULES:
        m = rule.pattern.search(log)
        if m:
            # capture surrounding line as evidence quote
            start = log.rfind("\n", 0, m.start()) + 1
            end = log.find("\n", m.end())
            if end == -1:
                end = len(log)
            quote = log[start:end].strip()[:500]
            return RuleMatch(
                category=rule.category,
                title=rule.title,
                cause=rule.cause,
                explanation=rule.explanation,
                fixes=rule.fixes,
                is_transient=rule.is_transient,
                confidence=rule.confidence,
                matched_quote=quote,
            )
    return None
