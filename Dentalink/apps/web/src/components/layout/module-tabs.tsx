import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ModuleTab = {
  to: string;
  label: string;
  icon?: ReactNode;
  activeMatch?: string;
};

export function ModuleTabs({ tabs, actions }: { tabs: ModuleTab[]; actions?: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="border-b border-[var(--border-default)] bg-white px-2">
      <div className="flex min-h-[56px] items-center justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-[var(--space-2)] rounded-full px-4 py-2 text-sm font-semibold transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)]",
                  active
                    ? "bg-[var(--action-primary)] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {tab.icon && <span className={active ? "text-white/80" : "text-slate-400"}>{tab.icon}</span>}
                {tab.label}
              </Link>
            );
          })}
        </div>
        {actions && <div className="flex items-center gap-2 px-3">{actions}</div>}
      </div>
    </div>
  );
}

export function WarnerSuitePanel({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`mx-auto max-w-[1150px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_4px_24px_rgba(4,44,83,0.04)] ${className}`}>
      {children}
    </section>
  );
}
