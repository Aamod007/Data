from app.models import RootCauseCategory as C
from app.services.triage import classify


def _cat(log: str) -> C | None:
    m = classify(log)
    return m.category if m else None


def test_oom():
    assert _cat("java.lang.OutOfMemoryError: Java heap space") == C.resource_exhaustion


def test_oom_killed_container():
    assert _cat("Task exited with return code Negsignal.SIGKILL, container OOMKilled") == C.resource_exhaustion


def test_permission_denied():
    assert _cat("ERROR: permission denied for schema analytics") == C.permissions


def test_expired_credentials():
    assert _cat("snowflake.connector.errors.DatabaseError: 390114: Authentication token expired") == C.permissions


def test_missing_column():
    assert _cat('psycopg2.errors.UndefinedColumn: column "customer_tier" does not exist') == C.schema_drift


def test_snowflake_invalid_identifier():
    assert _cat("000904 (42000): SQL compilation error: invalid identifier 'CUSTOMER_TIER'") is not None


def test_missing_table():
    assert _cat("Table or view not found: raw.orders_v2") == C.schema_drift


def test_type_mismatch():
    assert _cat("Numeric value 'N/A' is not recognized") == C.schema_drift


def test_deadlock_transient():
    m = classify("psycopg2.errors.DeadlockDetected: deadlock detected")
    assert m.category == C.concurrency
    assert m.is_transient


def test_timeout():
    assert _cat("airflow.exceptions.AirflowTaskTimeout: Timeout, task exceeded timeout") == C.timeout


def test_connectivity():
    m = classify("requests.exceptions.ConnectionError: HTTPSConnectionPool: connection refused")
    assert m.category == C.connectivity
    assert m.is_transient


def test_rate_limit():
    assert _cat("HTTP 429 Too Many Requests returned from API") == C.quota_limit


def test_constraint_violation():
    assert _cat('null value in column "order_id" violates not-null constraint') == C.data_quality


def test_dbt_test_failure():
    assert _cat("Failure in test unique_orders_order_id: FAIL 23 rows") == C.data_quality


def test_missing_file():
    assert _cat("FileNotFoundError: No such file or directory: '/landing/2026-07-16/orders.csv'") == C.upstream_data


def test_missing_module():
    assert _cat("ModuleNotFoundError: No module named 'pyarrow'") == C.configuration


def test_syntax_error():
    assert _cat("SQL compilation error: syntax error line 3 at position 12 unexpected 'FRM'") is not None


def test_upstream_failed():
    m = classify("Task set to upstream_failed because dependency extract_orders failed")
    assert m.category == C.dependency_failure


def test_spark_shuffle():
    assert _cat("org.apache.spark.shuffle.FetchFailedException: Failed to connect") == C.resource_exhaustion


def test_no_match_returns_none():
    assert classify("everything is fine, all rows loaded") is None


def test_evidence_quote_captured():
    m = classify("2026-07-16 ERROR java.lang.OutOfMemoryError: Java heap space at Executor.run")
    assert "OutOfMemoryError" in m.matched_quote
