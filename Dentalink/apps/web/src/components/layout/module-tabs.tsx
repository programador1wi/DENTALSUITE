import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/ui/select";

export type ModuleTab = {
  to: string;
  label: string;
  icon?: ReactNode;
  activeMatch?: string;
};

type ModuleTabsVariant = "default" | "dentalink";

export function ModuleTabs({
  tabs,
  actions,
  variant = "default"
}: {
  tabs: ModuleTab[];
  actions?: React.ReactNode;
  variant?: ModuleTabsVariant;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDentalink = variant === "dentalink";
  const activeTab = tabs.find((tab) => location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false));

  return (
    <div className={cn("border-b border-[var(--border-default)] bg-white", isDentalink ? "px-0" : "px-2")}>
      <div className={cn("flex min-w-0 flex-col sm:flex-row sm:items-center sm:justify-between", isDentalink ? "min-h-10" : "min-h-[56px]")}> 
        <div className="w-full min-w-0 p-2 sm:hidden">
          <Select
            aria-label="Sección del módulo"
            value={activeTab?.to ?? tabs[0]?.to ?? ""}
            onChange={(event) => navigate(event.target.value)}
          >
            {tabs.map((tab) => <option key={tab.to} value={tab.to}>{tab.label}</option>)}
          </Select>
        </div>
        <div className={cn("hidden min-w-0 items-stretch sm:flex sm:flex-wrap", isDentalink ? "gap-0" : "gap-1 p-1 sm:items-center sm:p-0")}> 
          {tabs.map((tab) => {
            const active =
              location.pathname === tab.to ||
              (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-[var(--space-2)] transition-[background-color,color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-default)]",
                  isDentalink
                    ? "min-h-10 border-x border-transparent px-3 py-2 text-xs font-medium"
                    : "min-w-0 justify-center rounded-[var(--radius-md)] px-3 py-2 text-center text-sm font-semibold sm:justify-start sm:px-4",
                  active && isDentalink && "border-slate-200 bg-slate-100 text-slate-700",
                  !active && isDentalink && "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                  active && !isDentalink && "bg-[var(--action-primary)] text-white shadow-sm",
                  !active && !isDentalink && "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {tab.icon && (
                  <span
                    className={cn(
                      active && !isDentalink ? "text-white/80" : "text-slate-400",
                      active && isDentalink && "text-slate-600"
                    )}
                  >
                    {tab.icon}
                  </span>
                )}
                <span className="min-w-0 break-words">{tab.label}</span>
              </Link>
            );
          })}
        </div>
        {actions ? <div className="flex w-full items-center justify-end gap-2 border-t border-[var(--border-default)] px-3 py-2 sm:w-auto sm:border-t-0 sm:py-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export function WarnerSuitePanel({
  children,
  className = ""
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`mx-auto max-w-[1150px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_4px_24px_rgba(4,44,83,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}
