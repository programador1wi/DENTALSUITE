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
    <div className="border-b border-[var(--border-strong)] bg-[var(--bg-surface)]">
      <div className="flex min-h-[48px] items-stretch justify-between">
        <div className="flex flex-wrap">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-[var(--space-2)] border-r border-[var(--border-default)] px-[var(--space-4)] text-[var(--text-base)] text-[var(--text-secondary)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-brand)]",
                  active && "bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)] shadow-[inset_0_-3px_0_var(--border-brand)]"
                )}
              >
                {tab.icon && <span className="text-[var(--text-secondary)]">{tab.icon}</span>}
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
    <section className={`mx-auto max-w-[1150px] border border-[var(--border-default)] bg-[var(--bg-surface)] ${className}`}>
      {children}
    </section>
  );
}
