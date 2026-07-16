"""End-to-end: webhook ingestion -> incident -> diagnosis -> feedback -> learning."""

AIRFLOW_FAILURE = {
    "dag_id": "daily_sales",
    "dag_run_id": "scheduled__2026-07-16T02:00:00",
    "state": "failed",
    "run_type": "scheduled",
    "start_date": "2026-07-16T02:00:00Z",
    "end_date": "2026-07-16T02:14:10Z",
    "task_instances": [
        {
            "task_id": "extract_orders",
            "operator": "PythonOperator",
            "state": "success",
            "try_number": 1,
        },
        {
            "task_id": "load_orders",
            "operator": "PostgresOperator",
            "state": "failed",
            "try_number": 2,
            "upstream_task_ids": ["extract_orders"],
            "log": (
                "2026-07-16 02:14:07 INFO executing INSERT INTO analytics.orders\n"
                "2026-07-16 02:14:09 ERROR psycopg2.errors.UndefinedColumn: "
                'column "customer_tier" does not exist\n'
                "LINE 3: select customer_tier from raw.orders\n"
                "connection: postgresql://etl_user:s3cretpass@db.internal/prod"
            ),
        },
        {
            "task_id": "publish_metrics",
            "operator": "PythonOperator",
            "state": "upstream_failed",
            "upstream_task_ids": ["load_orders"],
        },
    ],
}

DBT_FAILURE = {
    "project_name": "analytics",
    "run_id": "run-991",
    "run_results": {
        "metadata": {"invocation_id": "abc-123", "dbt_version": "1.8.0",
                     "generated_at": "2026-07-16T03:00:00Z"},
        "results": [
            {"unique_id": "model.analytics.stg_orders", "status": "success", "timing": []},
            {"unique_id": "model.analytics.fct_revenue", "status": "error",
             "message": "Database Error in model fct_revenue: 000904 (42000): "
                        "SQL compilation error: invalid identifier 'CUSTOMER_TIER'",
             "timing": []},
        ],
    },
}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_airflow_ingestion_creates_diagnosed_incident(client):
    r = client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE)
    assert r.status_code == 200, r.text
    ack = r.json()
    assert ack["incident_id"]
    assert ack["deduplicated"] is False

    detail = client.get(f"/v1/incidents/{ack['incident_id']}").json()
    assert detail["status"] == "open"
    assert detail["root_cause_category"] == "schema_drift"
    assert detail["diagnoses"], "incident must be diagnosed on ingestion"
    diag = detail["diagnoses"][0]
    assert diag["fixes"]
    assert diag["evidence"]
    # secret must never be stored
    for log in detail["logs"]:
        assert "s3cretpass" not in log["content"]


def test_duplicate_failure_deduplicates(client):
    first = client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE).json()
    again = {**AIRFLOW_FAILURE, "dag_run_id": "scheduled__2026-07-17T02:00:00"}
    second = client.post("/v1/ingest/airflow", json=again).json()
    assert second["incident_id"] == first["incident_id"]
    assert second["deduplicated"] is True

    detail = client.get(f"/v1/incidents/{first['incident_id']}").json()
    assert detail["occurrence_count"] == 2


def test_dbt_ingestion(client):
    r = client.post("/v1/ingest/dbt", json=DBT_FAILURE)
    assert r.status_code == 200, r.text
    incident_id = r.json()["incident_id"]
    assert incident_id
    detail = client.get(f"/v1/incidents/{incident_id}").json()
    assert detail["platform"] == "dbt"
    assert detail["root_cause_category"] == "schema_drift"


def test_success_run_creates_no_incident(client):
    ok = {**AIRFLOW_FAILURE, "state": "success",
          "task_instances": [{"task_id": "t", "state": "success"}]}
    r = client.post("/v1/ingest/airflow", json=ok)
    assert r.json()["incident_id"] is None


def test_resolve_and_recurrence_note(client):
    first = client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE).json()
    client.patch(f"/v1/incidents/{first['incident_id']}/status",
                 json={"status": "resolved",
                       "resolution_notes": "Re-added customer_tier to raw.orders"})

    # same failure later -> new incident, but diagnosis knows the history
    again = {**AIRFLOW_FAILURE, "dag_run_id": "scheduled__2026-07-20T02:00:00"}
    second = client.post("/v1/ingest/airflow", json=again).json()
    assert second["incident_id"] != first["incident_id"]
    detail = client.get(f"/v1/incidents/{second['incident_id']}").json()
    explanation = detail["diagnoses"][0]["explanation"]
    assert "seen before" in explanation
    assert "customer_tier" in explanation  # carries prior resolution notes


def test_feedback_learning_loop(client):
    ack = client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE).json()
    r = client.post(f"/v1/incidents/{ack['incident_id']}/feedback",
                    json={"verdict": "fixed_it",
                          "comment": "Restored the dropped column upstream"})
    assert r.status_code == 201


def test_adhoc_diagnose(client):
    r = client.post("/v1/diagnose", json={
        "platform": "generic",
        "log": "java.lang.OutOfMemoryError: Java heap space",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["root_cause_category"] == "resource_exhaustion"
    assert body["fixes"]


def test_adhoc_diagnose_rejects_empty(client):
    assert client.post("/v1/diagnose", json={"log": "  "}).status_code == 422


def test_dashboard(client):
    client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE)
    client.post("/v1/ingest/dbt", json=DBT_FAILURE)
    stats = client.get("/v1/dashboard").json()
    assert stats["total_incidents"] == 2
    assert stats["open_incidents"] == 2
    assert stats["incidents_by_category"].get("schema_drift") == 2
    assert set(stats["incidents_by_platform"]) == {"airflow", "dbt"}


def test_incident_list_filter(client):
    client.post("/v1/ingest/airflow", json=AIRFLOW_FAILURE)
    open_list = client.get("/v1/incidents", params={"status": "open"}).json()
    assert len(open_list) == 1
    resolved_list = client.get("/v1/incidents", params={"status": "resolved"}).json()
    assert resolved_list == []
