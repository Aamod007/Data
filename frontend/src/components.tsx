import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">🩺 Pipeline Doctor</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/incidents">Incidents</NavLink>
          <NavLink to="/pipelines">Pipelines</NavLink>
          <NavLink to="/diagnose">Ad-hoc Diagnose</NavLink>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return <span className="badge category">undiagnosed</span>;
  return <span className="badge category">{category.replace(/_/g, " ")}</span>;
}

export function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return <span className="badge platform">{platform}</span>;
}

export function ConfidenceLabel({ value }: { value: number | null }) {
  if (value == null) return <span className="confidence">—</span>;
  const cls = value >= 0.75 ? "high" : value >= 0.5 ? "mid" : "low";
  return <span className={`confidence ${cls}`}>{Math.round(value * 100)}%</span>;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
