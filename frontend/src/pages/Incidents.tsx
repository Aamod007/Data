import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { IncidentSummary } from "../api/client";
import { api } from "../api/client";
import { STATUS_TAG } from "../components/Pills";
import { stroke } from "../components/icons";
import { useFetch } from "../hooks/useFetch";
import { timeAgo } from "../lib/time";
import "./incidents.css";

const FILTERS = ["all", "open", "acknowledged", "resolved", "ignored"] as const;

/* inline icons, matching the house stroke style */
const iSearch = (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <circle cx="7" cy="7" r="4.6" />
    <path d="m10.6 10.6 3.4 3.4" />
  </svg>
);
const iChevron = (
  <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <path d="m4 6 4 4 4-4" />
  </svg>
);
const iCheck = (
  <svg width="12" height="12" viewBox="0 0 16 16" {...stroke} strokeWidth={2.4}>
    <path d="m3 8.4 3.2 3.2L13 4.8" />
  </svg>
);
const iSearchX = (
  <svg width="24" height="24" viewBox="0 0 16 16" {...stroke}>
    <circle cx="7" cy="7" r="4.6" />
    <path d="m10.6 10.6 3.4 3.4" />
    <path d="M5.4 5.4 8.6 8.6M8.6 5.4 5.4 8.6" />
  </svg>
);
const iOffline = (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <path d="M1.5 5.5A9.4 9.4 0 0 1 8 3c2.5 0 4.8.9 6.5 2.5M4 8.2A5.9 5.9 0 0 1 8 6.6c1.5 0 2.9.6 4 1.6M6.4 10.8A2.9 2.9 0 0 1 8 10.2c.6 0 1.2.2 1.6.6" />
    <path d="M8 13.2v.1" />
    <path d="m2 2 12 12" />
  </svg>
);
const iToastGood = (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="m5.2 8.2 2 2 3.6-4" />
  </svg>
);
const iToastBan = (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M3.6 3.6 12.4 12.4" />
  </svg>
);

function Check({ on, onClick }: { on: boolean; onClick: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      className={`inc-check${on ? " is-on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Deselect incident" : "Select incident"}
      onClick={onClick}
    >
      {iCheck}
    </button>
  );
}

interface Toast {
  id: number;
  kind: "good" | "warn";
  title: string;
  sub: string;
}

export default function IncidentsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const { data: incidents, error, reload } = useFetch(
    () => api.incidents(filter === "all" ? undefined : filter),
    [filter],
  );

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const uniq = (vals: (string | null)[]) =>
      [...new Set(vals.filter((v): v is string => !!v))].sort();
    return {
      platforms: uniq((incidents ?? []).map((i) => i.platform)),
      categories: uniq((incidents ?? []).map((i) => i.root_cause_category)),
      pipelines: uniq((incidents ?? []).map((i) => i.pipeline_name)),
    };
  }, [incidents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (incidents ?? []).filter(
      (i) =>
        (!platform || i.platform === platform) &&
        (!category || i.root_cause_category === category) &&
        (!pipeline || i.pipeline_name === pipeline) &&
        (!q ||
          [i.title, i.pipeline_name, i.platform ?? "", i.root_cause_category ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [incidents, query, platform, category, pipeline]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.id)));

  const pushToast = (kind: Toast["kind"], title: string, sub: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, title, sub }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };

  const bulkAct = async (status: "resolved" | "ignored") => {
    const ids = [...selected];
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => api.updateStatus(id, status)));
      pushToast(
        status === "resolved" ? "good" : "warn",
        status === "resolved" ? "Bulk resolve complete" : "Bulk ignore complete",
        `${ids.length} incident${ids.length === 1 ? "" : "s"} updated successfully.`,
      );
      setSelected(new Set());
      reload();
    } catch (e) {
      pushToast("warn", "Bulk update failed", String(e));
    } finally {
      setBusy(false);
    }
  };

  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: string[],
  ) => (
    <span className="inc-select">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {iChevron}
    </span>
  );

  return (
    <div className="inc-wrap">
      {error && (
        <div className="error-banner inc-error">
          <div className="inc-error-lead">
            {iOffline}
            <div>
              <strong>Unable to connect to backend</strong>
              <small>Data may be outdated. Check your connection and try again. ({error})</small>
            </div>
          </div>
          <button className="inc-retry" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      <header className="inc-head">
        <h1>Incidents</h1>
        <p className="inc-sub">
          Failures detected, deduplicated, and diagnosed. Track, triage, and resolve incident
          patterns across your pipelines.
        </p>
      </header>

      <div className="inc-toolbar">
        <label className="inc-search">
          {iSearch}
          <input
            type="text"
            placeholder="Search incidents, categories, pipelines"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {select("Platform", platform, setPlatform, options.platforms)}
        {select("Category", category, setCategory, options.categories)}
        {select("Pipeline", pipeline, setPipeline, options.pipelines)}
      </div>

      <div className="filters">
        <span className="inc-eyebrow">Status</span>
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="inc-bulk">
          <div className="inc-bulk-left">
            <Check on={allSelected} onClick={toggleAll} />
            <span>{selected.size} selected</span>
          </div>
          <div className="btn-row">
            <button className="inc-soft" disabled={busy} onClick={() => bulkAct("resolved")}>
              Resolve
            </button>
            <button className="inc-soft" disabled={busy} onClick={() => bulkAct("ignored")}>
              Ignore
            </button>
          </div>
        </div>
      )}

      {!incidents && !error ? (
        <div className="inc-skel">
          {[0, 1].map((k) => (
            <div className="panel" key={k}>
              <div className="inc-skel">
                <span style={{ width: "28%" }} />
                <span style={{ width: "72%", height: 20 }} />
                <span />
                <span style={{ width: "82%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <section className="panel inc-empty">
          <div className="inc-empty-icon">{iSearchX}</div>
          <div>
            <h3>No incidents match this filter</h3>
            <p>Try adjusting status, platform, category, or pipeline filters to broaden the results.</p>
          </div>
        </section>
      ) : (
        <section className="inc-list">
          {visible.map((inc: IncidentSummary) => (
            <article
              className="inc-card"
              key={inc.id}
              onClick={() => navigate(`/incidents/${inc.id}`)}
            >
              <div className="inc-card-top">
                <div className="inc-card-lead">
                  <Check
                    on={selected.has(inc.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(inc.id);
                    }}
                  />
                  <div className="inc-card-main">
                    <div className="inc-chiprow">
                      <span className="inc-chip">{timeAgo(inc.first_seen_at)}</span>
                      {inc.occurrence_count > 1 && (
                        <span className="inc-chip">×{inc.occurrence_count}</span>
                      )}
                      {inc.confidence != null && (
                        <span className="inc-chip">
                          Confidence {Math.round(inc.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <h2>{inc.title}</h2>
                    <div className="inc-chiprow">
                      <span className={`tag ${STATUS_TAG[inc.status]}`}>{inc.status}</span>
                      <span className="inc-chip">
                        {(inc.root_cause_category ?? "undiagnosed").replace(/_/g, " ")}
                      </span>
                      {inc.platform && <span className="inc-chip">Platform: {inc.platform}</span>}
                      <span className="inc-chip">Pipeline: {inc.pipeline_name}</span>
                    </div>
                  </div>
                </div>
                <div className="inc-card-side">
                  <span className="inc-chip">Last seen {timeAgo(inc.last_seen_at)}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {toasts.length > 0 && (
        <div className="inc-toasts">
          {toasts.map((t) => (
            <div className="inc-toast" key={t.id}>
              <span className={`inc-toast-ico ${t.kind}`}>
                {t.kind === "good" ? iToastGood : iToastBan}
              </span>
              <div>
                <strong>{t.title}</strong>
                <small>{t.sub}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
