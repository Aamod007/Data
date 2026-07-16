import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type DashboardStats } from "../api";
import {
  CategoryBadge,
  ConfidenceLabel,
  PlatformBadge,
  StatusBadge,
  timeAgo,
} from "../components";

function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <div className="empty">No data yet</div>;
  return (
    <div>
      {entries.map(([label, count]) => (
        <div className="bar-row" key={label}>
          <div className="bar-label">{label.replace(/_/g, " ")}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <div className="bar-count">{count}</div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(setStats).catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="error-banner">Backend unreachable: {error}</div>;
  if (!stats) return <div className="empty">Loading…</div>;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="subtitle">Pipeline health at a glance</p>

      <div className="cards">
        <div className="card">
          <div className="value">{stats.total_incidents}</div>
          <div className="label">Total incidents</div>
        </div>
        <div className="card">
          <div className="value" style={{ color: "var(--red)" }}>{stats.open_incidents}</div>
          <div className="label">Open</div>
        </div>
        <div className="card">
          <div className="value" style={{ color: "var(--green)" }}>{stats.resolved_incidents}</div>
          <div className="label">Resolved</div>
        </div>
        <div className="card">
          <div className="value">{stats.recurring_incidents}</div>
          <div className="label">Recurring</div>
        </div>
        <div className="card">
          <div className="value">{Math.round(stats.avg_confidence * 100)}%</div>
          <div className="label">Avg diagnosis confidence</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>Recent incidents</h2>
          {stats.recent_incidents.length === 0 ? (
            <div className="empty">No incidents — pipelines are healthy 🎉</div>
          ) : (
            <table>
              <thead>
                <tr><th>Incident</th><th>Status</th><th>Seen</th></tr>
              </thead>
              <tbody>
                {stats.recent_incidents.map((inc) => (
                  <tr key={inc.id} className="clickable" onClick={() => navigate(`/incidents/${inc.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inc.title}</div>
                      <div className="meta-row">
                        <PlatformBadge platform={inc.platform} />
                        <CategoryBadge category={inc.root_cause_category} />
                        <ConfidenceLabel value={inc.confidence} />
                      </div>
                    </td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{timeAgo(inc.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="panel">
            <h2>Failures by root cause</h2>
            <BarChart data={stats.incidents_by_category} />
          </div>
          <div className="panel">
            <h2>Failures by platform</h2>
            <BarChart data={stats.incidents_by_platform} />
          </div>
        </div>
      </div>
    </>
  );
}
