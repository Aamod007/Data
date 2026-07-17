import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { DiagnosisPanel } from "../components/DiagnosisPanel";
import { STATUS_TAG } from "../components/Pills";
import { useFetch } from "../hooks/useFetch";
import { timeAgo } from "../lib/time";
import "./incidents.css";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: incident, error, reload } = useFetch(() => api.incident(id!), [id]);
  const [notes, setNotes] = useState("");
  const [feedbackSent, setFeedbackSent] = useState("");

  if (error) return <div className="error-banner">{error}</div>;
  if (!incident) {
    return (
      <div className="inc-wrap inc-detail">
        <div className="panel">
          <div className="inc-skel">
            <span style={{ width: "24%" }} />
            <span style={{ width: "68%", height: 22 }} />
            <span />
            <span style={{ width: "80%" }} />
          </div>
        </div>
      </div>
    );
  }

  const diag = incident.diagnoses[0];

  const setStatus = async (status: "acknowledged" | "resolved" | "ignored") => {
    await api.updateStatus(incident.id, status, status === "resolved" ? notes : "");
    reload();
  };

  const sendFeedback = async (verdict: string) => {
    await api.feedback(incident.id, verdict, verdict === "fixed_it" ? notes : "");
    setFeedbackSent(verdict);
  };

  return (
    <div className="inc-wrap inc-detail">
      <header className="inc-head">
        <div className="inc-chiprow">
          <span className="inc-chip">First seen {timeAgo(incident.first_seen_at)}</span>
          {incident.occurrence_count > 1 && (
            <span className="inc-chip">×{incident.occurrence_count}</span>
          )}
          {incident.confidence != null && (
            <span className="inc-chip">Confidence {Math.round(incident.confidence * 100)}%</span>
          )}
        </div>
        <h1>{incident.title}</h1>
        <div className="inc-chiprow">
          <span className={`tag ${STATUS_TAG[incident.status]}`}>{incident.status}</span>
          {incident.root_cause_category && (
            <span className="inc-chip">{incident.root_cause_category.replace(/_/g, " ")}</span>
          )}
          {incident.platform && <span className="inc-chip">Platform: {incident.platform}</span>}
          <span className="inc-chip">Pipeline: {incident.pipeline_name}</span>
          <span className="inc-chip">Last seen {timeAgo(incident.last_seen_at)}</span>
        </div>
      </header>

      {diag ? (
        <DiagnosisPanel diag={diag} variant="incident" />
      ) : (
        <div className="panel">
          <div className="empty">No diagnosis recorded.</div>
        </div>
      )}

      <div className="panel inc-panel">
        <p className="inc-eyebrow">Actions</p>
        <div className="btn-row">
          {incident.status === "open" && (
            <button onClick={() => setStatus("acknowledged")}>Acknowledge</button>
          )}
          {incident.status !== "resolved" && (
            <button className="success" onClick={() => setStatus("resolved")}>
              Mark resolved
            </button>
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

        <p className="inc-eyebrow">Was this diagnosis helpful?</p>
        {feedbackSent ? (
          <p className="note-good">
            Feedback recorded ({feedbackSent}).
            {feedbackSent === "fixed_it" && " This fix was added to your team's knowledge base."}
          </p>
        ) : (
          <div className="btn-row">
            <button onClick={() => sendFeedback("helpful")}>Helpful</button>
            <button onClick={() => sendFeedback("wrong")}>Wrong</button>
            <button className="primary" onClick={() => sendFeedback("fixed_it")}>
              This fixed it
            </button>
          </div>
        )}
      </div>

      {incident.logs.length > 0 && (
        <div className="panel inc-panel">
          <p className="inc-eyebrow">Failure logs (redacted)</p>
          {incident.logs.map((log, i) => (
            <div className="inc-log" key={i}>
              <div className="inc-log-head">
                <strong>{log.task}</strong>
                {log.redactions ? (
                  <span className="inc-chip">{log.redactions} secret(s) redacted</span>
                ) : null}
              </div>
              <pre className="log">{log.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
