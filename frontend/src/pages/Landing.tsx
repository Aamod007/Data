import { Link } from "react-router-dom";
import { stroke } from "../components/icons";
import "./landing.css";

const GITHUB_URL = "https://github.com/Aamod007/Data";

const IC = {
  spark: "M8 1.5 9.7 6.3 14.5 8 9.7 9.7 8 14.5 6.3 9.7 1.5 8 6.3 6.3Z",
  check: "M3.2 8.4 6.4 11.6 12.8 4.8",
  bolt: "M8.7 1.5 4 9h3.2l-.9 5.5L11 7H7.8l.9-5.5Z",
  rules: "M3 4.2h6.2M3 8h6.2M3 11.8h4M10.4 10.9l1.7 1.7 2.6-3.1",
  shield:
    "M8 1.6 13.2 3.5v4.2c0 3.3-2.2 5.5-5.2 6.7-3-1.2-5.2-3.4-5.2-6.7V3.5L8 1.6ZM5.7 8l1.7 1.7 3-3.4",
  layers: "M8 1.8 14 5 8 8.2 2 5 8 1.8ZM2 8.4 8 11.6 14 8.4",
  loop: "M13.4 8.6A5.5 5.5 0 1 1 12.1 4M13.6 1.5v2.8h-2.8",
  plug: "M5.5 1.8v3.4M10.5 1.8v3.4M3.5 5.2h9v2.6a4.5 4.5 0 0 1-9 0V5.2ZM8 12.3v2",
} as const;

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
      <path d={d} />
    </svg>
  );
}

type Tag = "amber" | "blue" | "red" | "violet" | "green" | "neutral";

type Feature = {
  tag: Tag;
  label: string;
  title: string;
  body: string;
  icon: string;
};

const FEATURES: Feature[] = [
  {
    tag: "amber", label: "Rules engine", icon: IC.rules,
    title: "18 failure classes, triaged instantly",
    body: "Deterministic rule triage catches the well-known majority of failures — offline, free, in milliseconds. No API key required.",
  },
  {
    tag: "blue", label: "AI diagnosis", icon: IC.spark,
    title: "Evidence-verified AI diagnosis",
    body: "Every evidence quote must appear verbatim in the log or it is dropped. Diagnoses with fabricated evidence are downgraded to hypotheses.",
  },
  {
    tag: "red", label: "Security", icon: IC.shield,
    title: "Secrets never leave the boundary",
    body: "Connection strings, keys, tokens, and high-entropy secrets are redacted before logs are stored or sent to any model.",
  },
  {
    tag: "violet", label: "Dedup", icon: IC.layers,
    title: "One incident per failure signature",
    body: "Volatile tokens are normalized out and the error template is hashed. Repeat failures fold into one incident with an occurrence count.",
  },
  {
    tag: "green", label: "Learning loop", icon: IC.loop,
    title: "“This fixed it” teaches the system",
    body: "Confirmed fixes join your workspace knowledge base, so the next occurrence is diagnosed instantly with the proven resolution.",
  },
  {
    tag: "neutral", label: "Connectors", icon: IC.plug,
    title: "Airflow, dbt, and anything else",
    body: "First-class Airflow and dbt webhooks, plus a canonical CPEM event endpoint any platform can post to.",
  },
];

const STEPS = [
  { n: "01", title: "Point a webhook", body: "Add a failure callback in Airflow or a dbt run_results upload. One POST per failed run." },
  { n: "02", title: "Get the diagnosis", body: "Redaction, fingerprinting, rule triage, and (optionally) AI analysis produce a root cause, plain-English explanation, evidence, and fixes." },
  { n: "03", title: "Fix and confirm", body: "Apply a recommended fix, mark the incident resolved, and confirm “this fixed it” so recurrences resolve themselves." },
];

function Brand({ sub }: { sub: string }) {
  return (
    <div className="lp-brand">
      <div className="lp-mark">
        <Icon d={IC.spark} size={18} />
      </div>
      <div className="lp-brand-text">
        <span className="lp-brand-name">Pipeline Doctor</span>
        <span className="lp-brand-sub">{sub}</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <div className="lp-shell">
        <header className="lp-nav">
          <Brand sub="AI data pipeline doctor" />
          <nav className="lp-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="lp-nav-cta">
            <a className="lp-nav-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link to="/dashboard" className="lp-btn lp-btn-primary">
              Open dashboard
            </Link>
          </div>
        </header>

        <section className="lp-hero">
          <span className="lp-badge">
            <Icon d={IC.spark} size={13} />
            AI-powered pipeline incident intelligence
          </span>
          <h1>Pipeline failures, diagnosed in minutes — not hours.</h1>
          <p>
            Pipeline Doctor ingests Airflow and dbt failures, deduplicates them into
            incidents, finds the root cause with hybrid rules + AI diagnosis, and
            recommends fixes backed by verbatim log evidence.
          </p>
          <div className="lp-cta">
            <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg">
              Open dashboard
            </Link>
            <a className="lp-text-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          </div>
        </section>

        <section id="features" className="lp-section">
          <div className="lp-section-head">
            <div>
              <span className="lp-badge">
                <Icon d={IC.spark} size={13} />
                Features
              </span>
              <h2>Everything between a red X and a confirmed fix.</h2>
            </div>
            <p>
              Rule triage, evidence-verified AI diagnosis, secret redaction, and a
              learning loop that keeps repeat failures from coming back.
            </p>
          </div>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div className="lp-feature" key={f.title}>
                <div className="lp-feature-head">
                  <div className="lp-chip">
                    <Icon d={f.icon} />
                  </div>
                  <span className={`tag ${f.tag}`}>{f.label}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="lp-section">
          <div className="lp-section-head">
            <div>
              <span className="lp-badge">
                <Icon d={IC.bolt} size={13} />
                How it works
              </span>
              <h2>From webhook to confirmed fix in three steps.</h2>
            </div>
            <p>
              One POST per failed run. Pipeline Doctor handles redaction, dedup,
              triage, and diagnosis from there.
            </p>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div className="lp-step" key={s.n}>
                <div className="lp-step-n">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-closer-panel">
            <span className="lp-badge">
              <Icon d={IC.check} size={13} />
              Get started
            </span>
            <h2>Point a webhook at it and stop re-debugging the same failure.</h2>
            <p>
              Pipeline Doctor turns raw failure logs into deduplicated incidents with
              root causes, evidence, and recommended fixes.
            </p>
            <div className="lp-plan">
              <div className="lp-plan-label">
                Runs free on deterministic rules — add an Anthropic API key to enable
                AI diagnosis.
              </div>
              <div className="lp-checks">
                <div>
                  <Icon d={IC.check} size={14} />
                  Deterministic rule triage — offline, in milliseconds, no API key
                </div>
                <div>
                  <Icon d={IC.check} size={14} />
                  AI diagnoses verified against verbatim log evidence
                </div>
                <div>
                  <Icon d={IC.check} size={14} />
                  Secrets redacted before logs are stored or sent anywhere
                </div>
              </div>
              <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-lg lp-btn-block">
                Open dashboard
              </Link>
            </div>
          </div>
        </section>

        <footer className="lp-foot">
          <div className="lp-foot-grid">
            <Brand sub="AI diagnosis for Airflow, dbt, and CPEM pipeline failures." />
            <div>
              <h4>Product</h4>
              <div className="lp-foot-links">
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/incidents">Incidents</Link>
                <Link to="/diagnose">Diagnose</Link>
                <Link to="/kb">Knowledge base</Link>
              </div>
            </div>
            <div>
              <h4>Resources</h4>
              <div className="lp-foot-links">
                <a href="#features">Features</a>
                <a href="#how">How it works</a>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </div>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>© 2026 Pipeline Doctor</span>
            <div className="lp-foot-notes">
              <span>Rules + LLM hybrid diagnosis</span>
              <span>Evidence verified verbatim</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
