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
    <div className="border-b border-slate-300 bg-gradient-to-b from-white to-slate-50">
      <div className="flex min-h-[48px] items-stretch justify-between">
        <div className="flex flex-wrap">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-1.5 border-r border-slate-200 px-4 text-[16px] text-slate-500 hover:text-[#0784d8]",
                  active && "bg-white text-[#333] shadow-[inset_0_-4px_0_#0695cf]"
                )}
              >
                {tab.icon && <span className="text-slate-500">{tab.icon}</span>}
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

export function DentalinkPanel({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`mx-auto max-w-[1150px] border border-slate-300 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}
