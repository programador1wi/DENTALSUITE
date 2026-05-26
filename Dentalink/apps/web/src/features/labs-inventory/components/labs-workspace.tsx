import type { PropsWithChildren, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";

type LabsNavItem = {
  to: string;
  label: string;
  match?: string;
  exact?: boolean;
  children?: Array<{ to: string; label: string }>;
};

const labsNav: LabsNavItem[] = [
  { to: "/labs", label: "Laboratorios", match: "/labs", exact: true },
  { to: "/labs/enabled", label: "Laboratorios habilitados" },
  { to: "/labs/procedures", label: "Procedimientos de laboratorio" },
  {
    to: "/labs/orders?view=pending",
    label: "Solicitudes",
    match: "/labs/orders",
    children: [
      { to: "/labs/orders?view=pending", label: "Pendiente" },
      { to: "/labs/orders?view=process", label: "En proceso" },
      { to: "/labs/orders?view=review", label: "En revision" },
      { to: "/labs/orders?view=finished", label: "Finalizada" }
    ]
  }
];

export function LabsWorkspace({
  children,
  title,
  description,
  action
}: PropsWithChildren<{ title: string; description: string; action?: ReactNode }>) {
  const location = useLocation();

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      <Card className="overflow-visible p-0">
        <div className="flex flex-wrap items-stretch justify-between border-b border-slate-200 bg-slate-50">
          <nav className="flex flex-wrap">
            {labsNav.map((item) => {
              const active = item.match
                ? location.pathname === item.match || (!item.exact && location.pathname.startsWith(`${item.match}/`))
                : location.pathname === item.to;

              return (
                <div key={item.to} className="group relative">
                  <Link
                    to={item.to}
                    className={cn(
                      "flex h-full min-h-[58px] items-center gap-2 border-r border-slate-200 px-5 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-900",
                      active && "bg-white text-brand-700 shadow-[inset_0_-3px_0_rgb(14_165_233)]"
                    )}
                  >
                    {item.label}
                    {item.children ? <span className="text-xs">v</span> : null}
                  </Link>

                  {item.children ? (
                    <div className="invisible absolute left-0 top-full z-20 min-w-[190px] rounded-b-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                      {item.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-700"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          {action ? <div className="flex items-center gap-2 px-4 py-3">{action}</div> : null}
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
}

export function LabInfoBanner({ children }: PropsWithChildren) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      {children}
    </div>
  );
}

export function LabsPrimaryAction({ children, onClick }: PropsWithChildren<{ onClick: () => void }>) {
  return <Button onClick={onClick}>{children}</Button>;
}
