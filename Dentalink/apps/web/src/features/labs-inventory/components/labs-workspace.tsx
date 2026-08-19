import type { PropsWithChildren, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/ui/select";

export type LabRequestView = "pending" | "process" | "review" | "finished";

export const LAB_REQUEST_STATE_META: Record<
  LabRequestView,
  {
    label: string;
    plural: string;
    dotClass: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  pending: {
    label: "Pendiente",
    plural: "Pendientes",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700",
    bgClass: "bg-sky-50",
    borderClass: "border-sky-200"
  },
  process: {
    label: "En proceso",
    plural: "En proceso",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200"
  },
  review: {
    label: "En revision",
    plural: "En revision",
    dotClass: "bg-indigo-500",
    textClass: "text-indigo-700",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200"
  },
  finished: {
    label: "Finalizada",
    plural: "Finalizadas",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200"
  }
};

type LabsNavItem = {
  to: string;
  label: string;
  match?: string;
  exact?: boolean;
  children?: Array<{ to: string; view: LabRequestView }>;
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
      { to: "/labs/orders?view=pending", view: "pending" },
      { to: "/labs/orders?view=process", view: "process" },
      { to: "/labs/orders?view=review", view: "review" },
      { to: "/labs/orders?view=finished", view: "finished" }
    ]
  }
];

function currentRequestsView(search: string): LabRequestView {
  const value = new URLSearchParams(search).get("view");
  if (value === "process" || value === "review" || value === "finished") return value;
  return "pending";
}

export function LabsWorkspace({
  children,
  title,
  description,
  action
}: PropsWithChildren<{ title: string; description: string; action?: ReactNode }>) {
  const location = useLocation();
  const navigate = useNavigate();
  const requestView = currentRequestsView(location.search);
  const mobileValue = location.pathname === "/labs/orders" ? `/labs/orders?view=${requestView}` : location.pathname;

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />
      <Card className="overflow-visible p-0">
        <div className="flex min-w-0 flex-col border-b border-slate-200 bg-slate-50 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="w-full min-w-0 p-3 lg:hidden">
            <Select aria-label="Sección de laboratorios" value={mobileValue} onChange={(event) => navigate(event.target.value)}>
              <option value="/labs">Laboratorios</option>
              <option value="/labs/enabled">Laboratorios habilitados</option>
              <option value="/labs/procedures">Procedimientos de laboratorio</option>
              {labsNav.find((item) => item.children)?.children?.map((child) => (
                <option key={child.to} value={child.to}>Solicitudes: {LAB_REQUEST_STATE_META[child.view].plural}</option>
              ))}
            </Select>
          </div>
          <nav className="hidden min-w-0 lg:flex lg:flex-wrap" aria-label="Secciones de laboratorios">
            {labsNav.map((item) => {
              const active = item.match
                ? location.pathname === item.match || (!item.exact && location.pathname.startsWith(`${item.match}/`))
                : location.pathname === item.to;

              return (
                <div key={item.to} className="group relative min-w-0">
                  <Link
                    to={item.to}
                    aria-haspopup={item.children ? "menu" : undefined}
                    className={cn(
                      "flex h-full min-h-[58px] min-w-0 items-center justify-center gap-2 border-r border-slate-200 px-3 text-center text-sm font-semibold leading-tight text-slate-500 hover:bg-white hover:text-slate-900 lg:justify-start lg:px-5 lg:text-left",
                      active && "bg-white text-brand-700 shadow-[inset_0_-3px_0_rgb(14_165_233)]"
                    )}
                  >
                    {item.label}
                    {item.children ? (
                      <ChevronDown
                        className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>

                  {item.children ? (
                    <div
                      className="invisible absolute right-0 top-full z-20 w-[min(230px,calc(100vw-3rem))] rounded-b-lg border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 before:absolute before:-top-3 before:inset-x-0 before:h-3 lg:left-0 lg:right-auto lg:w-auto lg:min-w-[230px]"
                      role="menu"
                    >
                      {item.children.map((child) => {
                        const meta = LAB_REQUEST_STATE_META[child.view];
                        const childActive = location.pathname === "/labs/orders" && requestView === child.view;

                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={cn(
                              "mb-1 flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium last:mb-0 hover:bg-slate-50",
                              childActive && meta.bgClass,
                              childActive && meta.borderClass,
                              childActive ? meta.textClass : "text-slate-700"
                            )}
                            role="menuitem"
                          >
                            <span className={cn("h-2.5 w-2.5 rounded-full", meta.dotClass)} />
                            <span>{meta.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          {action ? <div className="flex items-center gap-2 px-4 py-3 lg:shrink-0">{action}</div> : null}
        </div>
        <div className="min-w-0 p-4 sm:p-5">{children}</div>
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
