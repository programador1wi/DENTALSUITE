import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils/cn";

export type PatientSecondaryTab = {
  to: string;
  label: string;
  activeMatch?: string;
  permission?: string;
  count?: number;
};

export function PatientSecondaryNav({ tabs, label }: { tabs: PatientSecondaryTab[]; label: string }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const visibleTabs = tabs.filter((tab) => !tab.permission || hasPermission(tab.permission));

  if (!visibleTabs.length) return null;

  return (
    <nav className="overflow-x-auto border border-slate-200 bg-white shadow-sm" aria-label={label}>
      <div className="inline-flex min-w-full items-stretch">
        {visibleTabs.map((tab) => {
          const active = location.pathname === tab.to || (tab.activeMatch ? location.pathname.startsWith(tab.activeMatch) : false);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "whitespace-nowrap border-r border-slate-200 px-4 py-3 text-xs font-semibold transition",
                active
                  ? "bg-white text-[#0879d5] shadow-[inset_0_-3px_0_#0879d5]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 ? (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0879d5] px-1.5 text-[10px] font-bold text-white">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
