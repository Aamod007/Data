import type { IncidentStatus } from "../api/client";
import { timeAgo } from "../lib/time";
import { icons } from "./icons";

/** status → .tag color class (kanban-style tinted labels) */
export const STATUS_TAG: Record<IncidentStatus, string> = {
  open: "red",
  acknowledged: "amber",
  resolved: "green",
  ignored: "neutral",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

export function CategoryPill({ category }: { category: string | null }) {
  return <span className="pill">{(category ?? "undiagnosed").replace(/_/g, " ")}</span>;
}

export function PlatformPill({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return <span className="pill platform">{platform}</span>;
}

export function TimePill({ iso }: { iso: string }) {
  return (
    <span className="pill time">
      {icons.clock} {timeAgo(iso)}
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: number | null }) {
  if (value == null) return <span className="confidence">—</span>;
  const cls = value >= 0.75 ? "high" : value >= 0.5 ? "mid" : "low";
  return <span className={`confidence ${cls}`}>{Math.round(value * 100)}%</span>;
}
