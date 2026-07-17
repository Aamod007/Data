import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BASE } from "../api/client";
import { icons, stroke } from "../components/icons";
import "./integrations.css";

const AIRFLOW_SNIPPET = `# airflow: DAG-level failure callback
import requests

def notify_pipeline_doctor(context):
    dr = context["dag_run"]
    requests.post(
        "${"${PD_URL}"}/v1/ingest/airflow",
        headers={"X-API-Key": "<PD_INGEST_API_KEY, if set>"},
        json={
            "dag_id": dr.dag_id,
            "dag_run_id": dr.run_id,
            "state": "failed",
            "run_type": dr.run_type,
            "start_date": str(dr.start_date),
            "end_date": str(dr.end_date),
            "task_instances": [
                {
                    "task_id": ti.task_id,
                    "operator": ti.operator,
                    "state": ti.state,
                    "try_number": ti.try_number,
                    "upstream_task_ids": list(ti.task.upstream_task_ids),
                    "log": read_task_log(ti),  # your log fetcher
                }
                for ti in dr.get_task_instances()
            ],
        },
        timeout=10,
    )

# DAG(..., on_failure_callback=notify_pipeline_doctor)`.replace("${PD_URL}", BASE);

const DBT_SNIPPET = `# after dbt run / build (on-run-end or CI step)
curl -X POST ${BASE}/v1/ingest/dbt \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <PD_INGEST_API_KEY, if set>" \\
  -d @<(jq '{project_name: "analytics", run_results: .}' target/run_results.json)`;

const GENERIC_SNIPPET = `curl -X POST ${BASE}/v1/ingest/event \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <PD_INGEST_API_KEY, if set>" \\
  -d '{
    "platform": "generic",
    "pipeline_external_id": "nightly_export",
    "pipeline_name": "Nightly export",
    "run_external_id": "run-2026-07-16",
    "status": "failed",
    "tasks": [{
      "task_id": "load",
      "status": "failed",
      "log": "psycopg2.OperationalError: FATAL: connection refused"
    }]
  }'`;

/* small stroke glyphs for the connector tiles (same style as components/icons) */
const glyphs = {
  dbt: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5Z" />
      <path d="M9.5 1.5V5H13" />
      <path d="M6.2 8.2 4.8 9.6l1.4 1.4M9.8 8.2l1.4 1.4-1.4 1.4" />
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M4.5 12.5a3 3 0 0 1-.4-6A4 4 0 0 1 12 7.6a2.5 2.5 0 0 1-.5 4.9h-7Z" />
    </svg>
  ),
  database: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <ellipse cx="8" cy="3.6" rx="5" ry="2" />
      <path d="M3 3.6v8.8c0 1.1 2.2 2 5 2s5-.9 5-2V3.6" />
      <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </svg>
  ),
  snowflake: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5" />
    </svg>
  ),
  spark: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
      <path d="M8 2.2 9.4 6.6 13.8 8 9.4 9.4 8 13.8 6.6 9.4 2.2 8l4.4-1.4L8 2.2Z" />
    </svg>
  ),
};

type Connector = {
  name: string;
  icon: ReactNode;
  live: boolean;
  path?: string; // ingest endpoint path, live connectors only
  anchor: string; // setup panel to jump to
};

const CONNECTORS: Connector[] = [
  { name: "Apache Airflow", icon: icons.pipelines, live: true, path: "/v1/ingest/airflow", anchor: "ig-setup-airflow" },
  { name: "dbt", icon: glyphs.dbt, live: true, path: "/v1/ingest/dbt", anchor: "ig-setup-dbt" },
  { name: "Generic CPEM", icon: icons.bolt, live: true, path: "/v1/ingest/event", anchor: "ig-setup-generic" },
  { name: "Azure Data Factory", icon: glyphs.cloud, live: false, anchor: "ig-setup-generic" },
  { name: "Databricks", icon: glyphs.database, live: false, anchor: "ig-setup-generic" },
  { name: "Snowflake tasks", icon: glyphs.snowflake, live: false, anchor: "ig-setup-generic" },
  { name: "Spark", icon: glyphs.spark, live: false, anchor: "ig-setup-generic" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Webhook({ id, name, tagCls, tagLabel, url, snippet }: {
  id: string; name: string; tagCls: string; tagLabel: string; url: string; snippet: string;
}) {
  return (
    <div className="panel ig-hook" id={id}>
      <div className="ig-hook-head">
        <h2>{name}</h2>
        <span className={`tag ${tagCls}`}>{tagLabel}</span>
      </div>
      <div className="ig-url">
        <code>POST {url}</code>
        <CopyButton text={url} />
      </div>
      <pre className="log">{snippet}</pre>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <h1>Integrations</h1>
      <p className="subtitle">Connect your data platforms — one POST per failed run</p>

      <div className="ig-grid">
        {CONNECTORS.map((c) => (
          <div className="card ig-card" key={c.name}>
            <div className="ig-card-top">
              <div className="ig-card-id">
                <div className="ig-icon">{c.icon}</div>
                <div>
                  <div className="ig-name">{c.name}</div>
                  <span className={`tag ${c.live ? "green" : "amber"}`}>
                    {c.live ? "Live" : "Planned"}
                  </span>
                </div>
              </div>
              <a className="ig-setup" href={`#${c.anchor}`}>
                {c.live ? "Setup" : "Use generic"}
              </a>
            </div>
            <div className="meta-row">
              {c.path ? (
                <code>POST {c.path}</code>
              ) : (
                <span>Post the generic CPEM shape today</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Webhook
        id="ig-setup-airflow"
        name="Apache Airflow"
        tagCls="green" tagLabel="live"
        url={`${BASE}/v1/ingest/airflow`}
        snippet={AIRFLOW_SNIPPET}
      />
      <Webhook
        id="ig-setup-dbt"
        name="dbt (Core artifact or Cloud)"
        tagCls="green" tagLabel="live"
        url={`${BASE}/v1/ingest/dbt`}
        snippet={DBT_SNIPPET}
      />
      <Webhook
        id="ig-setup-generic"
        name="Generic CPEM event (any platform)"
        tagCls="green" tagLabel="live"
        url={`${BASE}/v1/ingest/event`}
        snippet={GENERIC_SNIPPET}
      />

      <div className="panel">
        <h2>Authentication</h2>
        <p className="ig-note">
          If the backend sets <code>PD_INGEST_API_KEY</code>, every ingest request must send it in the{" "}
          <code>X-API-Key</code> header. When unset (local/dev), ingest is open.
        </p>
      </div>

      <div className="ig-cta">
        <div className="ig-icon">{icons.plug}</div>
        <h3>No integration wired up yet?</h3>
        <p>
          Azure Data Factory, Databricks, Snowflake tasks, and Spark can already post the
          generic CPEM shape above — or try Pipeline Doctor without any integration.
        </p>
        <Link to="/diagnose" className="ig-cta-btn">Paste a log in Diagnose</Link>
      </div>
    </>
  );
}
