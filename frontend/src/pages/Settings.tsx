import { BASE, api } from "../api/client";
import { stroke } from "../components/icons";
import { useFetch } from "../hooks/useFetch";
import "./settings.css";

const ENV_VARS = [
  ["PD_DATABASE_URL", "sqlite:///./pipeline_doctor.db", "Database. Point at Postgres in production."],
  ["PD_ANTHROPIC_API_KEY", "(empty)", "Enables AI diagnosis; rules-only when unset."],
  ["PD_DIAGNOSIS_MODEL", "claude-sonnet-5", "Main diagnosis model."],
  ["PD_MAX_DIAGNOSIS_TOKENS", "4096", "Output token cap per diagnosis."],
  ["PD_LOG_CONTEXT_BUDGET", "24000", "Log characters sent to the LLM after smart truncation."],
  ["PD_INGEST_API_KEY", "(empty)", "Shared secret for ingest webhooks (X-API-Key). Empty disables auth."],
  ["PD_CORS_ORIGINS", "localhost:3000, localhost:5173", "Allowed web app origins."],
] as const;

const PRIVACY = [
  ["Secret redaction", "Connection strings, keys, tokens, emails, and high-entropy strings are redacted before logs are stored or sent to any model."],
  ["Evidence verification", "Every AI evidence quote must appear verbatim in the log, or it is dropped and the diagnosis is downgraded to a hypothesis."],
  ["Logs are data", "Log content is treated as data, never as instructions."],
] as const;

const refreshIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <path d="M13.6 8a5.6 5.6 0 1 1-1.7-4M13.6 1.6V4h-2.4" />
  </svg>
);

const wifiOffIcon = (
  <svg width="18" height="18" viewBox="0 0 16 16" {...stroke}>
    <path d="M1.5 5.8a10 10 0 0 1 4.1-2.3M9.2 3.3a10 10 0 0 1 5.3 2.5" />
    <path d="M4 8.4a6.6 6.6 0 0 1 2.5-1.4M9.8 6.8a6.6 6.6 0 0 1 2.2 1.6" />
    <path d="M6.4 10.9a3.4 3.4 0 0 1 3.2 0" />
    <path d="M8 13.2v.1" />
    <path d="M2 2l12 12" />
  </svg>
);

export default function SettingsPage() {
  const { data: health, error, reload } = useFetch(() => api.health());

  return (
    <>
      <div className="st-head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">System status and configuration reference</p>
        </div>
        <button onClick={reload}>{refreshIcon} Refresh</button>
      </div>

      {error && (
        <div className="st-offline">
          <div className="st-offline-left">
            {wifiOffIcon}
            <div>
              <div className="st-offline-title">Unable to connect to backend</div>
              <div className="st-offline-desc">
                Status may be outdated. Check that the API is running at <code>{BASE}</code>, then retry.
              </div>
            </div>
          </div>
          <button className="st-retry" onClick={reload}>Retry</button>
        </div>
      )}

      <div className="panel">
        <div className="st-sec-head">
          <h2>System status</h2>
          <p className="st-sec-desc">Live health of the API and diagnosis engine.</p>
        </div>
        <div className="st-rows">
          <div className="st-row">
            <div className="st-row-main">
              <div className="st-row-title">Backend</div>
              <div className="st-row-desc">
                <code className="st-code">{BASE}</code>
                {health && <span className="st-app">{health.app}</span>}
              </div>
            </div>
            {error ? (
              <span className="tag red">unreachable</span>
            ) : health ? (
              <span className="tag green">connected</span>
            ) : (
              <span className="tag neutral">checking…</span>
            )}
          </div>
          <div className="st-row">
            <div className="st-row-main">
              <div className="st-row-title">Diagnosis engine</div>
              <div className="st-row-desc">
                {health && !health.ai_enabled
                  ? "Set PD_ANTHROPIC_API_KEY on the backend to enable AI diagnosis."
                  : "Determined by PD_ANTHROPIC_API_KEY on the backend."}
              </div>
            </div>
            {health ? (
              health.ai_enabled ? (
                <span className="tag green">AI enabled</span>
              ) : (
                <span className="tag amber">rules-only</span>
              )
            ) : (
              <span className="tag neutral">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="st-sec-head">
          <h2>Backend configuration</h2>
          <p className="st-sec-desc">
            Set via environment variables on the API server. Read-only reference — there is no settings write API.
          </p>
        </div>
        <table>
          <thead>
            <tr><th>Variable</th><th>Default</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            {ENV_VARS.map(([name, def, why]) => (
              <tr key={name}>
                <td><code className="st-var">{name}</code></td>
                <td className="st-def">{def}</td>
                <td className="st-why">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="st-sec-head">
          <h2>Frontend</h2>
          <p className="st-sec-desc">Build-time configuration for this web app.</p>
        </div>
        <div className="st-rows">
          <div className="st-row">
            <div className="st-row-main">
              <div className="st-row-title"><code className="st-var">VITE_API_URL</code></div>
              <div className="st-row-desc">Backend base URL for this web app.</div>
            </div>
            <code className="st-code">{BASE}</code>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="st-sec-head">
          <h2>Data &amp; privacy</h2>
          <p className="st-sec-desc">How Pipeline Doctor handles log content.</p>
        </div>
        <div className="st-rows">
          {PRIVACY.map(([title, desc]) => (
            <div className="st-row" key={title}>
              <div className="st-row-main">
                <div className="st-row-title">{title}</div>
                <div className="st-row-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
