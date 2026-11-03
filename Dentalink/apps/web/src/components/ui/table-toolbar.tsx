import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function TableToolbar({
  leading,
  search,
  filters,
  actions,
  className
}: {
  leading?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)]",
        className
      )}
      aria-label="Controles del listado"
    >
      {leading ? (
        <div className="mb-[var(--space-3)] flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
          {leading}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-[var(--space-3)] lg:flex-row lg:items-center">
        {search ? <div className="min-w-0 flex-1 lg:min-w-64">{search}</div> : null}
        {filters ? (
          <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)] [&>*]:min-w-0">
            {filters}
          </div>
        ) : null}
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)] lg:ml-auto lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TableActionGroup({
  children,
  align = "end",
  className
}: {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-[var(--space-2)]",
        align === "end" && "justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TableResultCount({ children }: { children: ReactNode }) {
  return <p className="text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">{children}</p>;
}
