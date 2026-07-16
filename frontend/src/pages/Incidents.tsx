import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type IncidentSummary } from "../api";
import {
  CategoryBadge,
  ConfidenceLabel,
  PlatformBadge,
  StatusBadge,
  timeAgo,
} from "../components";

const FILTERS = ["all", "open", "acknowledged", "resolved", "ignored"] as const;

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .incidents(filter === "all" ? undefined : filter)
      .then(setIncidents)
      .catch((e) => setError(String(e)));
  }, [filter]);

  return (
    <>
      <h1>Incidents</h1>
      <p className="subtitle">Failures detected, deduplicated, and diagnosed</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="panel">
        {incidents.length === 0 ? (
          <div className="empty">No incidents match this filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Root cause</th>
                <th>Status</th>
                <th>Occurrences</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="clickable" onClick={() => navigate(`/incidents/${inc.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inc.title}</div>
                    <div className="meta-row">
                      <PlatformBadge platform={inc.platform} />
                      <span>{inc.pipeline_name}</span>
                    </div>
                  </td>
                  <td>
                    <CategoryBadge category={inc.root_cause_category} />
                    <div className="meta-row">
                      <ConfidenceLabel value={inc.confidence} />
                    </div>
                  </td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>{inc.occurrence_count > 1 ? `×${inc.occurrence_count}` : "1"}</td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{timeAgo(inc.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
