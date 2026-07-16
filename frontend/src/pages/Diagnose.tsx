import { useState } from "react";
import { api, type Diagnosis } from "../api/client";
import { DiagnosisPanel } from "../components/DiagnosisPanel";

const PLATFORMS = ["generic", "airflow", "dbt", "spark", "databricks", "snowflake", "adf"];

export default function DiagnosePage() {
  const [log, setLog] = useState("");
  const [platform, setPlatform] = useState("generic");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.diagnose(log, platform, context));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Diagnose</h1>
      <p className="subtitle">Paste any failure log — no integration required</p>

      <div className="panel">
        <div className="btn-row" style={{ alignItems: "center" }}>
          <label style={{ color: "var(--muted)" }}>Platform:</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <textarea
          className="mono"
          placeholder="Paste the failure log here…"
          value={log}
          onChange={(e) => setLog(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="Optional context: what were you running?"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
        <div className="btn-row">
          <button className="primary" disabled={busy || !log.trim()} onClick={run}>
            {busy ? "Diagnosing…" : "Diagnose"}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </div>

      {result && <DiagnosisPanel diag={result} />}
    </>
  );
}
