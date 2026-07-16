import { useEffect, useState } from "react";
import { api, type PipelineRow } from "../api";
import { PlatformBadge } from "../components";

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.pipelines().then(setPipelines).catch((e) => setError(String(e)));
  }, []);

  return (
    <>
      <h1>Pipelines</h1>
      <p className="subtitle">Everything Pipeline Doctor is watching</p>
      {error && <div className="error-banner">{error}</div>}
      <div className="panel">
        {pipelines.length === 0 ? (
          <div className="empty">
            No pipelines yet. Point your Airflow/dbt webhooks at{" "}
            <code>/v1/ingest/airflow</code> or <code>/v1/ingest/dbt</code>.
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Pipeline</th><th>Platform</th><th>Runs</th><th>Failed</th><th>Failure rate</th></tr>
            </thead>
            <tbody>
              {pipelines.map((p) => {
                const rate = p.run_count ? p.failed_count / p.run_count : 0;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><PlatformBadge platform={p.platform} /></td>
                    <td>{p.run_count}</td>
                    <td style={{ color: p.failed_count ? "var(--red)" : "var(--muted)" }}>
                      {p.failed_count}
                    </td>
                    <td style={{ color: rate > 0.5 ? "var(--red)" : rate > 0 ? "var(--amber)" : "var(--green)" }}>
                      {Math.round(rate * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
