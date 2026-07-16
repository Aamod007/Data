"""Seed the running API with realistic demo failures.

Usage: python scripts/seed_demo.py [--url http://localhost:8000]
"""
import argparse
import sys

import httpx

DEMO_EVENTS = [
    # 1. Airflow OOM on a Spark-submitting task
    ("airflow", {
        "dag_id": "customer_360_refresh",
        "dag_run_id": "scheduled__2026-07-15T04:00:00",
        "state": "failed",
        "run_type": "scheduled",
        "start_date": "2026-07-15T04:00:00Z",
        "end_date": "2026-07-15T04:47:12Z",
        "task_instances": [
            {"task_id": "extract_events", "operator": "S3ToSnowflakeOperator", "state": "success"},
            {"task_id": "score_customers", "operator": "SparkSubmitOperator", "state": "failed",
             "try_number": 3,
             "upstream_task_ids": ["extract_events"],
             "log": "26/07/15 04:32:11 INFO DAGScheduler: Submitting 800 missing tasks from ShuffleMapStage 4\n"
                    "26/07/15 04:41:33 WARN TaskSetManager: Lost task 133.0 in stage 4.0: ExecutorLostFailure (executor 7 exited caused by one of the running tasks)\n"
                    "26/07/15 04:41:35 ERROR YarnScheduler: Lost executor 7 on worker-19: Container killed by YARN for exceeding memory limits. 12.4 GB of 12 GB physical memory used.\n"
                    "java.lang.OutOfMemoryError: Java heap space\n"
                    "    at org.apache.spark.sql.execution.joins.UnsafeHashedRelation.apply\n"
                    "26/07/15 04:47:10 ERROR ApplicationMaster: User application exited with status 137"},
            {"task_id": "publish_segments", "operator": "PythonOperator", "state": "upstream_failed",
             "upstream_task_ids": ["score_customers"]},
        ],
    }),
    # 2. dbt schema drift
    ("dbt", {
        "project_name": "analytics",
        "job_id": "nightly-build",
        "run_id": "run-20260715-0300",
        "run_results": {
            "metadata": {"invocation_id": "b7e2", "dbt_version": "1.8.2",
                         "generated_at": "2026-07-15T03:09:00Z"},
            "results": [
                {"unique_id": "model.analytics.stg_payments", "status": "success", "timing": []},
                {"unique_id": "model.analytics.fct_daily_revenue", "status": "error",
                 "message": "Database Error in model fct_daily_revenue (models/marts/fct_daily_revenue.sql)\n"
                            "  000904 (42000): SQL compilation error: error line 14 at position 8\n"
                            "  invalid identifier 'PAYMENTS.PROVIDER_FEE'",
                 "compiled_code": "select\n    order_date,\n    sum(amount) as gross_revenue,\n    sum(payments.provider_fee) as fees\nfrom {{ ref('stg_payments') }} payments\ngroup by 1",
                 "timing": []},
            ],
        },
    }),
    # 3. Airflow permission failure after credential rotation
    ("airflow", {
        "dag_id": "marketing_attribution",
        "dag_run_id": "scheduled__2026-07-16T01:00:00",
        "state": "failed",
        "run_type": "scheduled",
        "task_instances": [
            {"task_id": "load_ad_spend", "operator": "SnowflakeOperator", "state": "failed",
             "try_number": 1,
             "log": "[2026-07-16, 01:03:22 UTC] {snowflake.py:381} INFO - Running statement: COPY INTO marketing.ad_spend\n"
                    "[2026-07-16, 01:03:24 UTC] {taskinstance.py:1937} ERROR - Task failed with exception\n"
                    "snowflake.connector.errors.ProgrammingError: 003001 (42501): SQL access control error:\n"
                    "Insufficient privileges to operate on table 'AD_SPEND'"},
        ],
    }),
    # 4. Airflow upstream file missing (late vendor drop)
    ("airflow", {
        "dag_id": "vendor_inventory_sync",
        "dag_run_id": "scheduled__2026-07-16T06:00:00",
        "state": "failed",
        "run_type": "scheduled",
        "task_instances": [
            {"task_id": "ingest_vendor_file", "operator": "PythonOperator", "state": "failed",
             "try_number": 4,
             "log": "[2026-07-16, 06:15:02 UTC] INFO - Looking for abfss://landing@datalake.dfs.core.windows.net/vendor_x/2026/07/16/inventory.csv\n"
                    "azure.core.exceptions.ResourceNotFoundError: The specified blob does not exist.\n"
                    "ErrorCode:BlobNotFound"},
        ],
    }),
    # 5. dbt data quality test failure
    ("dbt", {
        "project_name": "analytics",
        "job_id": "hourly-tests",
        "run_id": "run-20260716-1100",
        "run_results": {
            "metadata": {"invocation_id": "c9d1", "dbt_version": "1.8.2",
                         "generated_at": "2026-07-16T11:05:00Z"},
            "results": [
                {"unique_id": "test.analytics.unique_fct_orders_order_id", "status": "fail",
                 "message": "FAIL 847 rows: unique_fct_orders_order_id — got 847 duplicate order_id values",
                 "timing": []},
            ],
        },
    }),
    # 6. Airflow transient deadlock (will be marked transient)
    ("airflow", {
        "dag_id": "hourly_upsert",
        "dag_run_id": "scheduled__2026-07-16T09:00:00",
        "state": "failed",
        "run_type": "scheduled",
        "task_instances": [
            {"task_id": "upsert_orders", "operator": "PostgresOperator", "state": "failed",
             "try_number": 2,
             "log": "[2026-07-16, 09:02:14 UTC] ERROR - psycopg2.errors.DeadlockDetected: deadlock detected\n"
                    "DETAIL: Process 22143 waits for ShareLock on transaction 991822; blocked by process 22101.\n"
                    "Process 22101 waits for ShareLock on transaction 991820; blocked by process 22143.\n"
                    "HINT: See server log for query details."},
        ],
    }),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()

    for platform, payload in DEMO_EVENTS:
        r = httpx.post(f"{args.url}/v1/ingest/{platform}", json=payload, timeout=60)
        r.raise_for_status()
        ack = r.json()
        name = payload.get("dag_id") or payload.get("project_name")
        print(f"[{platform}] {name}: incident={ack['incident_id']} dedup={ack['deduplicated']}")
    print("\nSeeded. Open the incident feed to explore.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
