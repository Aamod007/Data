import { Link } from "react-router-dom";
import { icons } from "../components/icons";
import "./kb.css";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const searchIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <circle cx="7" cy="7" r="4.6" />
    <path d="M10.4 10.4 14 14" />
  </svg>
);

const filterIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
  </svg>
);

const STEPS = [
  {
    tag: "blue", label: "1 · Resolve",
    title: "Resolve an incident",
    body: "Fix the failure, mark the incident resolved, and leave resolution notes describing what worked.",
  },
  {
    tag: "green", label: "2 · Confirm",
    title: "Confirm “This fixed it”",
    body: "The feedback event promotes the diagnosis into a learned pattern: the incident's error signature, cause, and your proven fix.",
  },
  {
    tag: "violet", label: "3 · Auto-match",
    title: "Recurrences resolve instantly",
    body: "New failures are matched against learned patterns by error signature. A hit returns the proven fix immediately — no LLM call needed.",
  },
];

const SEED_FAMILIES = [
  "Airflow · SIGTERM / zombie tasks",
  "dbt · ref/source + hook failures",
  "Snowflake · identifier / warehouse errors",
];

// decorative placeholder cards (design's skeleton grid); bar widths in %
const SKELETONS: number[][] = [
  [66, 83, 80, 75],
  [50, 75, 66, 83],
  [60, 80, 66, 83],
];

export default function KnowledgeBasePage() {
  return (
    <>
      <div className="kb-head">
        <div>
          <h1>Knowledge Base</h1>
          <p className="subtitle">Learnings from resolved incidents and feedback</p>
        </div>
        <div className="kb-chrome-row">
          <button className="kb-chrome" disabled title="Search becomes available once patterns are learned">
            {searchIcon} Search knowledge
          </button>
          <button className="kb-chrome" disabled title="Filters become available once patterns are learned">
            {filterIcon} Filters
          </button>
        </div>
      </div>

      <div className="kb-steps">
        {STEPS.map((s) => (
          <div className="card kb-step" key={s.title}>
            <span className={`tag ${s.tag}`}>{s.label}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <section className="kb-section">
        <h2>Learned patterns</h2>
        <div className="kb-empty-card">
          <span className="kb-empty-icon">{icons.book}</span>
          <div className="kb-empty-title">No learned patterns yet</div>
          <p className="kb-hint">
            Resolve an incident and confirm “This fixed it” — feedback from
            resolved incidents populates this page.
          </p>
          <Link to="/incidents"><button className="primary">Go to incidents</button></Link>
        </div>
        <div className="kb-skel-grid" aria-hidden="true">
          {SKELETONS.map((widths, i) => (
            <div className="kb-skel" key={i}>
              {widths.map((w, j) => (
                <span className="kb-skel-bar" style={{ width: `${w}%` }} key={j} />
              ))}
              <span className="kb-skel-pills">
                <span className="kb-skel-pill" />
                <span className="kb-skel-pill" />
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="panel">
        <h2>Curated rules</h2>
        <p className="kb-note">
          Independent of learned patterns, 18 built-in failure classes (rule
          triage) and a curated seed knowledge base are always active — even
          with AI diagnosis disabled.
        </p>
        <div className="kb-seed-row">
          {SEED_FAMILIES.map((f) => (
            <span className="pill" key={f}>{f}</span>
          ))}
          <span className="pill time">+ more</span>
        </div>
      </div>
    </>
  );
}
