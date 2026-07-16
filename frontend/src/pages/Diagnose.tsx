import { useState } from "react";
import { api, type Diagnosis } from "../api";
import { CategoryBadge, ConfidenceLabel } from "../components";

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
      <h1>Ad-hoc Diagnose</h1>
      <p className="subtitle">Paste any failure log — no integration required</p>

      <div className="panel">
        <div className="btn-row" style={{ alignItems: "center" }}>
          <label style={{ color: "var(--muted)" }}>Platform:</label>
          <select style={{ width: 180 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
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

      {result && (
        <div className="panel">
          <h2>
            Diagnosis <CategoryBadge category={result.root_cause_category} />{" "}
            {result.is_transient && <span className="badge transient">likely transient</span>}
          </h2>
          <p style={{ fontWeight: 600, fontSize: 15 }}>{result.root_cause_summary}</p>
          <p className="explanation">{result.explanation}</p>

          {result.evidence.length > 0 && (
            <>
              <h2>Evidence</h2>
              {result.evidence.map((ev, i) => (
                <div className="evidence-quote" key={i}>{ev.quote}</div>
              ))}
            </>
          )}

          {result.fixes.length > 0 && (
            <>
              <h2>Recommended fixes</h2>
              {result.fixes.map((f, i) => (
                <div className="fix" key={i}>
                  <div className="fix-title">
                    {f.title} <span className="badge category">{f.type.replace(/_/g, " ")}</span>
                  </div>
                  {f.steps.length > 0 && <ol>{f.steps.map((s, j) => <li key={j}>{s}</li>)}</ol>}
                  {f.diff && <pre className="log">{f.diff}</pre>}
                </div>
              ))}
            </>
          )}

          <div className="meta-row">
            <span>confidence: <ConfidenceLabel value={result.confidence} /></span>
            <span>engine: {result.engine}</span>
            <span>{result.latency_ms}ms</span>
          </div>
        </div>
      )}
    </>
  );
}
