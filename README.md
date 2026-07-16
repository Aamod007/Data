# 🩺 AI Data Pipeline Doctor

An AI-powered platform that automatically diagnoses data pipeline failures, identifies
root causes, explains them in plain English, and recommends actionable fixes.
Supports Apache Airflow and dbt out of the box, with a canonical event model
(CPEM) designed to extend to ADF, Databricks, Snowflake, Fabric, and Spark.

> Detect, diagnose, and resolve pipeline failures in minutes instead of hours.

## Architecture

```
Airflow / dbt / CI ──webhooks──▶ Ingestion ──▶ Redaction ──▶ Fingerprinting
                                                                  │
                                              dedup? ◀── incident store
                                                                  │
                     Rule triage (18 failure classes, deterministic, free)
                                          │
                     Knowledge base (curated + tenant-learned patterns)
                                          │
                     Claude diagnosis (structured output + evidence verification)
                                          │
                  Incident + diagnosis + fixes  ──▶  Web app / API
```

Key design decisions:

- **CPEM (Canonical Pipeline Event Model)** — all platforms normalize to one schema
  (`Pipeline → Run → TaskRun → LogBundle`), so the diagnosis engine is platform-agnostic.
- **Hybrid diagnosis** — deterministic rules catch the well-known ~70% of failures
  instantly and for free; Claude handles the long tail with structured output.
  Without an `PD_ANTHROPIC_API_KEY`, the system still works fully on rules + KB.
- **Evidence verification** — every LLM evidence quote must appear verbatim in the
  log or it is dropped; diagnoses with fabricated evidence are downgraded to
  hypotheses. Log content is treated as data, never instructions.
- **Redaction before storage** — connection strings, keys, tokens, emails, and
  high-entropy secrets are stripped before logs are stored or sent to any model.
- **Fingerprinting** — volatile tokens (timestamps, ids, counts) are normalized out
  of error text and the template is hashed. Repeat failures dedup into one incident;
  resolved incidents power "seen this before, fixed by X" recurrence notes.
- **Learning loop** — a "this fixed it" feedback event promotes the resolution into
  the workspace's knowledge base, so the next occurrence is diagnosed instantly.

## Quickstart

### Backend (FastAPI, Python 3.11+)

```bash
cd backend
uv venv && uv pip install -e ".[dev]"
# optional: enable AI diagnosis
# export PD_ANTHROPIC_API_KEY=sk-ant-...
uvicorn app.main:app --port 8000
```

Seed realistic demo failures:

```bash
python scripts/seed_demo.py
```

Run tests (47):

```bash
python -m pytest
```

### Frontend (Vite + React + TypeScript)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, expects backend on :8000
```

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/ingest/airflow` | Airflow failure-callback webhook |
| `POST /v1/ingest/dbt` | dbt `run_results.json` (Cloud webhook or CI upload) |
| `POST /v1/ingest/event` | Generic canonical (CPEM) event, any platform |
| `POST /v1/diagnose` | Ad-hoc: paste a log, get a diagnosis (no setup needed) |
| `GET /v1/incidents` | Incident feed (filter by status/category) |
| `GET /v1/incidents/{id}` | Full detail: diagnosis, evidence, fixes, logs |
| `PATCH /v1/incidents/{id}/status` | Acknowledge / resolve / ignore |
| `POST /v1/incidents/{id}/feedback` | 👍 / 👎 / "fixed it" (feeds the learning loop) |
| `GET /v1/dashboard` | Aggregate stats |
| `GET /v1/pipelines` | Monitored pipelines with failure rates |

Interactive docs at `http://localhost:8000/docs`.

### Example: diagnose a pasted log

```bash
curl -X POST http://localhost:8000/v1/diagnose \
  -H "Content-Type: application/json" \
  -d '{"platform": "spark", "log": "java.lang.OutOfMemoryError: Java heap space"}'
```

## Configuration (env vars, prefix `PD_`)

| Variable | Default | Purpose |
|---|---|---|
| `PD_DATABASE_URL` | `sqlite:///./pipeline_doctor.db` | Postgres URL in prod |
| `PD_ANTHROPIC_API_KEY` | (empty) | Enables Claude diagnosis; rules-only otherwise |
| `PD_DIAGNOSIS_MODEL` | `claude-sonnet-5` | Main diagnosis model |
| `PD_INGEST_API_KEY` | (empty) | Shared-secret auth for ingest webhooks |
| `PD_CORS_ORIGINS` | localhost:3000,5173 | Allowed web app origins |

## Repo layout

```
backend/
  app/
    models.py            # CPEM: Workspace, Connection, Pipeline, Run, TaskRun,
                         # LogBundle, Incident, Diagnosis, KnowledgeItem, Feedback
    services/
      redaction.py       # secret/PII stripping (regex + entropy)
      fingerprint.py     # error normalization, hashing, smart log truncation
      triage.py          # 18 deterministic failure-class rules
      knowledge.py       # curated KB + tenant learning loop
      diagnosis.py       # Claude engine + evidence verification + fallback
      ingestion.py       # event -> entities -> incident -> diagnosis
    connectors/          # airflow.py, dbt.py payload normalizers
    routers/             # ingest, incidents, dashboard
  tests/                 # 47 tests: unit + end-to-end
  scripts/seed_demo.py   # realistic demo failures
frontend/
  src/pages/             # Dashboard, Incidents, IncidentDetail, Pipelines, Diagnose
```

## Roadmap

- ADF / Databricks / Snowflake-context connectors
- Agentic diagnosis (iterative log fetching via tool use)
- GitHub Actions / Azure DevOps CI checks; Slack & Teams bots
- SSO, RBAC, audit logs; pgvector hybrid KB retrieval
- Auto-fix PRs and postmortem generation
