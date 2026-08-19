import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import { Drawer } from "./drawer";
import { cn } from "@/lib/utils/cn";

export function ResponsiveFilterBar({
  children,
  activeCount = 0,
  title = "Filtros",
  description = "Ajusta los criterios para reducir los resultados.",
  mobileSummary,
  actions,
  className
}: {
  children: ReactNode;
  activeCount?: number;
  title?: string;
  description?: string;
  mobileSummary?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = activeCount > 0 ? `${title} (${activeCount})` : title;

  return (
    <section className={cn("mb-[var(--space-6)]", className)} aria-label="Controles de filtrado">
      <div className="hidden min-w-0 items-end gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)] md:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-[var(--space-3)]">{children}</div>
        {actions ? <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div> : null}
      </div>

      <div className="flex min-w-0 items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-3)] md:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} aria-label={label}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
        {mobileSummary ? <div className="min-w-0 flex-1 text-right text-[var(--text-sm)] text-[var(--text-secondary)]">{mobileSummary}</div> : null}
      </div>

      <Drawer open={open} title={label} description={description} placement="bottom" onClose={() => setOpen(false)}>
        <div className="grid gap-[var(--space-4)]">{children}</div>
        {actions ? <div className="mt-[var(--space-6)] flex flex-wrap justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-4)]">{actions}</div> : null}
      </Drawer>
    </section>
  );
}
