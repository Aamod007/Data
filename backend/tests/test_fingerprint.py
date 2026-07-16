from app.services.fingerprint import extract_error_lines, fingerprint, normalize, truncate_log

LOG_A = """
2026-07-16 02:14:07,123 INFO starting task load_orders attempt=1
2026-07-16 02:14:09,456 ERROR psycopg2.errors.UndefinedColumn: column "customer_tier" does not exist
LINE 3: select customer_tier from raw.orders
"""

LOG_B = """
2026-07-17 02:14:11,999 INFO starting task load_orders attempt=3
2026-07-17 02:14:14,001 ERROR psycopg2.errors.UndefinedColumn: column "customer_tier" does not exist
LINE 7: select customer_tier from raw.orders
"""

LOG_C = """
2026-07-17 02:14:11,999 ERROR java.lang.OutOfMemoryError: Java heap space
"""


def test_same_failure_same_fingerprint():
    assert fingerprint(LOG_A, "daily_sales", "PythonOperator") == \
           fingerprint(LOG_B, "daily_sales", "PythonOperator")


def test_different_error_different_fingerprint():
    assert fingerprint(LOG_A, "daily_sales", "PythonOperator") != \
           fingerprint(LOG_C, "daily_sales", "PythonOperator")


def test_different_pipeline_different_fingerprint():
    assert fingerprint(LOG_A, "daily_sales", "PythonOperator") != \
           fingerprint(LOG_A, "weekly_sales", "PythonOperator")


def test_normalize_strips_volatile_tokens():
    n = normalize("2026-07-16 02:14:07 error at line 33 in run 8f14e45f-ceea-467a-9a36-dedd4bea2543 took 42.5s")
    assert "2026" not in n
    assert "33" not in n
    assert "42.5" not in n


def test_extract_error_lines_finds_errors():
    lines = extract_error_lines(LOG_A)
    assert any("UndefinedColumn" in ln for ln in lines)
    assert not any("INFO starting" in ln for ln in lines)


def test_truncate_log_keeps_error_window():
    noise = "\n".join(f"INFO row {i} processed" for i in range(5000))
    log = noise + "\nFATAL ERROR: disk quota exceeded on /scratch\n" + noise
    out = truncate_log(log, budget=8000)
    assert len(out) < len(log)
    assert "disk quota exceeded" in out


def test_truncate_log_noop_when_small():
    assert truncate_log("short log", budget=1000) == "short log"
