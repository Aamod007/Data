import type { Diagnosis, Fix } from "../api/client";
import { CategoryPill, ConfidenceLabel } from "./Pills";

/** "diagnose" renders the standalone panel (pill/h2 styles); "incident" renders the inc-* styles. */
type Variant = "diagnose" | "incident";

function FixCard({ fix, variant }: { fix: Fix; variant: Variant }) {
  return (
    <div className="fix">
      <div className="fix-title">
        {fix.title}
        {variant === "incident" ? (
          <span className="tag blue">{fix.type.replace(/_/g, " ")}</span>
        ) : (
          <CategoryPill category={fix.type} />
        )}
        {fix.risk !== "low" && (
          <span className={variant === "incident" ? "tag amber" : "pill transient"}>
            risk: {fix.risk}
          </span>
        )}
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

export function DiagnosisPanel({ diag, variant = "diagnose" }: { diag: Diagnosis; variant?: Variant }) {
  const inc = variant === "incident";
  return (
    <div className={inc ? "panel inc-panel" : "panel"}>
      {inc ? (
        <>
          <p className="inc-eyebrow">Diagnosis</p>
          <div className="inc-chiprow">
            <span className="tag violet">{diag.root_cause_category.replace(/_/g, " ")}</span>
            {diag.is_transient && <span className="tag neutral">likely transient</span>}
            <span className="inc-chip">Confidence {Math.round(diag.confidence * 100)}%</span>
          </div>
          <p className="inc-summary">{diag.root_cause_summary}</p>
        </>
      ) : (
        <>
          <h2>
            Diagnosis <CategoryPill category={diag.root_cause_category} />{" "}
            {diag.is_transient && <span className="pill transient">likely transient</span>}
          </h2>
          <p style={{ fontWeight: 600, fontSize: 15, marginTop: 0 }}>{diag.root_cause_summary}</p>
        </>
      )}
      <p className="explanation">{diag.explanation}</p>

      {diag.evidence.length > 0 && (
        <>
          {inc ? <p className="inc-eyebrow">Evidence</p> : <h2 style={{ marginTop: 18 }}>Evidence</h2>}
          {diag.evidence.map((ev, i) => (
            <div className="evidence-quote" key={i}>
              {ev.quote}
              {inc && ev.source && <div className="inc-ev-src">{ev.source}</div>}
            </div>
          ))}
        </>
      )}

      {diag.fixes.length > 0 && (
        <>
          {inc ? (
            <p className="inc-eyebrow">Recommended fixes</p>
          ) : (
            <h2 style={{ marginTop: 18 }}>Recommended fixes</h2>
          )}
          {diag.fixes.map((f, i) => <FixCard fix={f} key={i} variant={variant} />)}
        </>
      )}

      <div className="meta-row">
        {!inc && <span>confidence: <ConfidenceLabel value={diag.confidence} /></span>}
        <span>engine: {diag.engine}{diag.model_version ? ` (${diag.model_version})` : ""}</span>
        <span>diagnosed in {diag.latency_ms}ms</span>
      </div>
    </div>
  );
}
