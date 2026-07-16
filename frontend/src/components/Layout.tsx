import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { icons } from "./icons";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <span className="mark">{icons.bolt}</span>
          Pipeline Doctor
        </div>
        <nav>
          <NavLink to="/dashboard">{icons.dashboard} Dashboard</NavLink>
          <NavLink to="/incidents">{icons.incidents} Incidents</NavLink>
          <NavLink to="/pipelines">{icons.pipelines} Pipelines</NavLink>
          <NavLink to="/diagnose">{icons.bolt} Diagnose</NavLink>
          <NavLink to="/kb">{icons.book} Knowledge Base</NavLink>
          <NavLink to="/integrations">{icons.plug} Integrations</NavLink>
          <NavLink to="/settings">{icons.gear} Settings</NavLink>
        </nav>
        <div className="foot">CPEM · Airflow · dbt</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
