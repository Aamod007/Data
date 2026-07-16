import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PlatformPill } from "../components/Pills";
import { useFetch } from "../hooks/useFetch";
import "./pipelines.css";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const glyphs = {
  refresh: (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <path d="M13.7 8A5.7 5.7 0 1 1 12 4" />
      <path d="M12.3 1.4v2.8H9.5" />
    </svg>
  ),
  retry: (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <path d="M2.3 8A5.7 5.7 0 1 0 4 4" />
      <path d="M3.7 1.4v2.8h2.8" />
    </svg>
  ),
  wifiOff: (
    <svg width="18" height="18" viewBox="0 0 16 16" {...stroke}>
      <path d="M2 6.2A9.2 9.2 0 0 1 5.9 4M9.9 3.7a9.2 9.2 0 0 1 4.1 2.5" />
      <path d="M4.4 8.9a5.8 5.8 0 0 1 2.1-1.3M9.6 7.7a5.8 5.8 0 0 1 2 1.2" />
      <path d="M6.8 11.5a2.6 2.6 0 0 1 2.4 0" />
      <path d="M8 13.6h.01" />
      <path d="m1.8 1.8 12.4 12.4" />
    </svg>
  ),
  searchX: (
    <svg width="28" height="28" viewBox="0 0 16 16" {...stroke}>
      <circle cx="7" cy="7" r="4.8" />
      <path d="m10.6 10.6 3.4 3.4" />
      <path d="m5.3 5.3 3.4 3.4M8.7 5.3 5.3 8.7" />
    </svg>
  ),
  plus: (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  ),
};

/** Design thresholds: <10% good, <25% warn, else critical. Bar colored, label stays muted. */
function RateBar({ rate }: { rate: number }) {
  const color =
    rate >= 0.25 ? "var(--critical)" : rate >= 0.1 ? "var(--warn)" : "var(--good)";
  return (
    <span className="rate">
      <span className="track">
        <span
          className="fill"
          style={{ width: `${Math.min(rate, 1) * 100}%`, background: color }}
        />
      </span>
      <span className="pl-rate-num">{(rate * 100).toFixed(1)}%</span>
    </span>
  );
}

const BONES: ReadonlyArray<readonly [number, number, number, number]> = [
  [160, 64, 40, 32],
  [208, 56, 48, 32],
  [144, 64, 40, 32],
];

function SkeletonBody() {
  return (
    <tbody>
      {BONES.map(([name, pill, runs, failed], i) => (
        <tr key={i}>
          <td><span className="pl-bone" style={{ width: name }} /></td>
          <td><span className="pl-bone pl-bone-pill" style={{ width: pill }} /></td>
          <td className="pl-num"><span className="pl-bone" style={{ width: runs }} /></td>
          <td className="pl-num"><span className="pl-bone" style={{ width: failed }} /></td>
          <td><span className="pl-bone pl-bone-bar" /></td>
        </tr>
      ))}
    </tbody>
  );
}

export default function PipelinesPage() {
  const { data: pipelines, error, reload } = useFetch(() => api.pipelines());
  const showEmpty = pipelines !== null && pipelines.length === 0;

  return (
    <>
      <div className="pl-head">
        <div>
          <h1>Pipelines</h1>
          <p className="subtitle">Monitor run health across all data platforms</p>
        </div>
        <button className="pl-btn" onClick={reload}>
          {glyphs.refresh} Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner pl-error">
          {glyphs.wifiOff}
          <div className="pl-error-copy">
            <span className="pl-error-title">Unable to connect to backend</span>
            <span className="pl-error-desc">{error}</span>
          </div>
          <button className="pl-btn pl-danger" onClick={reload}>
            {glyphs.retry} Retry
          </button>
        </div>
      )}

      {showEmpty ? (
        <div className="panel pl-empty">
          <div className="pl-empty-icon">{glyphs.searchX}</div>
          <div className="pl-empty-copy">
            <span className="pl-empty-title">No pipelines found</span>
            <span className="pl-empty-desc">
              Connect a data platform to start monitoring pipeline runs here.
            </span>
          </div>
          <Link className="pl-btn" to="/integrations">
            {glyphs.plus} Add pipeline source
          </Link>
        </div>
      ) : (
        (pipelines !== null || !error) && (
          <div className="panel pl-table">
            <table>
              <thead>
                <tr>
                  <th className="pl-c-name">Name</th>
                  <th className="pl-c-plat">Platform</th>
                  <th className="pl-num pl-c-num">Runs</th>
                  <th className="pl-num pl-c-num">Failed</th>
                  <th className="pl-c-rate">Failure Rate</th>
                </tr>
              </thead>
              {pipelines !== null ? (
                <tbody>
                  {pipelines.map((p) => (
                    <tr key={p.id}>
                      <td className="pl-name">{p.name}</td>
                      <td><PlatformPill platform={p.platform} /></td>
                      <td className="pl-num">{p.run_count}</td>
                      <td className="pl-num">{p.failed_count}</td>
                      <td>
                        <RateBar rate={p.run_count ? p.failed_count / p.run_count : 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <SkeletonBody />
              )}
            </table>
          </div>
        )
      )}
    </>
  );
}
