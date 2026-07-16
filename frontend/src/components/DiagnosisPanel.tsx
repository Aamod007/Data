import type { Diagnosis, Fix } from "../api/client";
import { CategoryPill, ConfidenceLabel } from "./Pills";

function FixCard({ fix }: { fix: Fix }) {
  return (
    <div className="fix">
      <div className="fix-title">
        {fix.title}
        <CategoryPill category={fix.type} />
        {fix.risk !== "low" && <span className="pill transient">risk: {fix.risk}</span>}
      </div>
      {fix.steps.length > 0 && (
        <ol>
          {fix.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
      {fix.diff && <pre className="log">{fix.diff}</pre>}
    </div>
  );
}

export function DiagnosisPanel({ diag }: { diag: Diagnosis }) {
  return (
    <div className="panel">
      <h2>
        Diagnosis <CategoryPill category={diag.root_cause_category} />{" "}
        {diag.is_transient && <span className="pill transient">likely transient</span>}
      </h2>
      <p style={{ fontWeight: 600, fontSize: 15, marginTop: 0 }}>{diag.root_cause_summary}</p>
      <p className="explanation">{diag.explanation}</p>

      {diag.evidence.length > 0 && (
        <>
          <h2 style={{ marginTop: 18 }}>Evidence</h2>
          {diag.evidence.map((ev, i) => (
            <div className="evidence-quote" key={i}>{ev.quote}</div>
          ))}
        </>
      )}

      {diag.fixes.length > 0 && (
        <>
          <h2 style={{ marginTop: 18 }}>Recommended fixes</h2>
          {diag.fixes.map((f, i) => <FixCard fix={f} key={i} />)}
        </>
      )}

      <div className="meta-row">
        <span>confidence: <ConfidenceLabel value={diag.confidence} /></span>
        <span>engine: {diag.engine}{diag.model_version ? ` (${diag.model_version})` : ""}</span>
        <span>diagnosed in {diag.latency_ms}ms</span>
      </div>
    </div>
  );
}
