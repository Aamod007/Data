import { api } from "../api/client";
import { IncidentCard } from "../components/IncidentCard";
import { useFetch } from "../hooks/useFetch";
import "./dashboard.css";

const refreshIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M13.6 8A5.6 5.6 0 1 1 11.96 4.04" />
    <path d="M13.8 1.6v2.8H11" />
  </svg>
);

/** Stat card: uppercase tracked label, large value, optional data strip below. */
function StatCard({ label, value, strip }: {
  label: string;
  value: string | number;
  strip?: number[];
}) {
  return (
    <div className="card db-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {strip && strip.length > 0 && (
        <div className="db-strip" aria-hidden>
          {strip.map((v, i) => (
            <span key={i} style={{ opacity: 0.14 + v * 0.4 }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Stacked distribution bars: label/count row above a full-width rounded track. */
function DistroBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div className="empty">No data yet</div>;
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="db-bars">
      {entries.map(([label, count], i) => (
        <div key={label}>
          <div className="db-bar-head">
            <span className="db-bar-label">{label.replace(/_/g, " ")}</span>
            <span className="db-bar-count">{count}</span>
          </div>
          <div className="db-bar-track">
            <div
              className="db-bar-fill"
              style={{
                width: `${(count / max) * 100}%`,
                opacity: Math.max(0.45, 1 - i * 0.16),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, error, reload } = useFetch(() => api.dashboard());
  const { data: health } = useFetch(() => api.health());

  if (error) return <div className="error-banner">Backend unreachable: {error}</div>;
  if (!stats) return <div className="empty">Loading…</div>;

  const catCounts = Object.values(stats.incidents_by_category);
  const catMax = Math.max(1, ...catCounts);

  return (
    <>
      <div className="db-head">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Monitor incident health, trends, and response performance</p>
        </div>
        <div className="db-head-actions">
          {health && (
            <span className="db-ai">
              <span className={`db-ai-dot${health.ai_enabled ? "" : " is-off"}`} />
              {health.ai_enabled ? "AI enabled" : "Rules only"}
            </span>
          )}
          <button className="db-refresh" onClick={reload}>
            {refreshIcon}
            Refresh
          </button>
        </div>
      </div>

      <div className="cards db-cards">
        <StatCard
          label="Total Incidents"
          value={stats.total_incidents}
          strip={catCounts.map((v) => v / catMax)}
        />
        <StatCard label="Open" value={stats.open_incidents} />
        <StatCard label="Resolved" value={stats.resolved_incidents} />
        <StatCard label="Recurring" value={stats.recurring_incidents} />
        <StatCard label="Avg Confidence" value={`${Math.round(stats.avg_confidence * 100)}%`} />
      </div>

      <div className="db-grid">
        <section className="panel db-panel db-feed">
          <div className="db-panel-head">
            <div>
              <h2>Recent Incidents</h2>
              <p className="db-panel-sub">Latest signals from production</p>
            </div>
            <span className="pill db-live">Live feed</span>
          </div>
          {stats.recent_incidents.length === 0 ? (
            <div className="empty">No incidents — pipelines are healthy.</div>
          ) : (
            stats.recent_incidents.map((inc) => <IncidentCard incident={inc} key={inc.id} />)
          )}
        </section>

        <div className="db-rail">
          <section className="panel db-panel">
            <h2>By Root Cause</h2>
            <DistroBars data={stats.incidents_by_category} />
          </section>
          <section className="panel db-panel">
            <h2>By Platform</h2>
            <DistroBars data={stats.incidents_by_platform} />
          </section>
        </div>
      </div>
    </>
  );
}
