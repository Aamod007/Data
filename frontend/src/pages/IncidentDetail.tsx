import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Diagnosis, type Fix, type IncidentDetail } from "../api";
import {
  CategoryBadge,
  ConfidenceLabel,
  PlatformBadge,
  StatusBadge,
  timeAgo,
} from "../components";

function FixCard({ fix }: { fix: Fix }) {
  return (
    <div className="fix">
      <div className="fix-title">
        {fix.title}
        <span className="badge category">{fix.type.replace(/_/g, " ")}</span>
        {fix.risk !== "low" && <span className="badge transient">risk: {fix.risk}</span>}
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

function DiagnosisPanel({ diag }: { diag: Diagnosis }) {
  return (
    <div className="panel">
      <h2>
        Diagnosis <CategoryBadge category={diag.root_cause_category} />{" "}
        {diag.is_transient && <span className="badge transient">likely transient</span>}
      </h2>
      <p style={{ fontWeight: 600, fontSize: 15 }}>{diag.root_cause_summary}</p>
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

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [feedbackSent, setFeedbackSent] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    api.incident(id).then(setIncident).catch((e) => setError(String(e)));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!incident) return <div className="empty">Loading…</div>;

  const diag = incident.diagnoses[0];

  const setStatus = async (status: "acknowledged" | "resolved" | "ignored") => {
    await api.updateStatus(incident.id, status, status === "resolved" ? notes : "");
    load();
  };

  const sendFeedback = async (verdict: string) => {
    await api.feedback(incident.id, verdict, verdict === "fixed_it" ? notes : "");
    setFeedbackSent(verdict);
  };

  return (
    <>
      <h1>{incident.title}</h1>
      <div className="meta-row" style={{ marginBottom: 20 }}>
        <StatusBadge status={incident.status} />
        <PlatformBadge platform={incident.platform} />
        <span>pipeline: {incident.pipeline_name}</span>
        <span>first seen {timeAgo(incident.first_seen_at)}</span>
        <span>last seen {timeAgo(incident.last_seen_at)}</span>
        {incident.occurrence_count > 1 && (
          <span style={{ color: "var(--amber)" }}>
            recurred ×{incident.occurrence_count}
          </span>
        )}
      </div>

      {diag ? <DiagnosisPanel diag={diag} /> : (
        <div className="panel"><div className="empty">No diagnosis recorded.</div></div>
      )}

      <div className="panel">
        <h2>Actions</h2>
        <div className="btn-row">
          {incident.status === "open" && (
            <button onClick={() => setStatus("acknowledged")}>Acknowledge</button>
          )}
          {incident.status !== "resolved" && (
            <button className="success" onClick={() => setStatus("resolved")}>Mark resolved</button>
          )}
          {incident.status !== "ignored" && incident.status !== "resolved" && (
            <button onClick={() => setStatus("ignored")}>Ignore</button>
          )}
        </div>
        <input
          type="text"
          placeholder="Resolution notes (stored with the incident; used to diagnose recurrences)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {incident.resolution_notes && (
          <p className="meta-row">Saved notes: {incident.resolution_notes}</p>
        )}

        <h2 style={{ marginTop: 18 }}>Was this diagnosis helpful?</h2>
        {feedbackSent ? (
          <p style={{ color: "var(--green)" }}>
            Feedback recorded ({feedbackSent}). {feedbackSent === "fixed_it" && "This fix was added to your team's knowledge base."}
          </p>
        ) : (
          <div className="btn-row">
            <button onClick={() => sendFeedback("helpful")}>👍 Helpful</button>
            <button onClick={() => sendFeedback("wrong")}>👎 Wrong</button>
            <button className="primary" onClick={() => sendFeedback("fixed_it")}>✅ This fixed it</button>
          </div>
        )}
      </div>

      {incident.logs.length > 0 && (
        <div className="panel">
          <h2>Failure logs (redacted)</h2>
          {incident.logs.map((log, i) => (
            <div key={i}>
              <div className="meta-row" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{log.task}</span>
                {log.redactions ? <span>{log.redactions} secret(s) redacted</span> : null}
              </div>
              <pre className="log">{log.content}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
