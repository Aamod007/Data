import { useNavigate } from "react-router-dom";
import type { IncidentSummary } from "../api/client";
import { CategoryPill, ConfidenceLabel, PlatformPill, StatusPill, TimePill } from "./Pills";

/** Card-style incident row, in the style of the reference dashboard. */
export function IncidentCard({ incident }: { incident: IncidentSummary }) {
  const navigate = useNavigate();
  return (
    <div className="item clickable" onClick={() => navigate(`/incidents/${incident.id}`)}>
      <div className="item-meta">
        <TimePill iso={incident.last_seen_at} />
        <span className="meta-row" style={{ marginTop: 0 }}>
          {incident.occurrence_count > 1 && <span>×{incident.occurrence_count}</span>}
          <ConfidenceLabel value={incident.confidence} />
        </span>
      </div>
      <div className="item-title">{incident.title}</div>
      <div className="pill-row">
        <StatusPill status={incident.status} />
        <CategoryPill category={incident.root_cause_category} />
        <PlatformPill platform={incident.platform} />
        <span className="pill platform">{incident.pipeline_name}</span>
      </div>
    </div>
  );
}
