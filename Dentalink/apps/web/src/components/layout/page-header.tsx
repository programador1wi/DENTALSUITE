import type { ReactNode } from "react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

export function PageHeader({ 
  title, 
  description,
  helpText,
  primaryAction,
  secondaryActions,
  mobileActions,
  eyebrow
}: { 
  title: string; 
  description?: string; 
  helpText?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  mobileActions?: ActionMenuItem[];
  eyebrow?: string;
}) {
  return (
    <header className="mb-[var(--space-6)] flex min-w-0 flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-[var(--space-1)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-[var(--text-brand)]">{eyebrow}</p> : null}
        <div className="flex min-w-0 items-center gap-[var(--space-2)]">
          <h1 className="min-w-0 text-balance text-[var(--text-2xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{title}</h1>
          {helpText ? <HelpTooltip content={helpText} /> : null}
        </div>
        {description ? <p className="mt-[var(--space-1)] max-w-3xl text-[var(--text-sm)] leading-[var(--leading-sm)] text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {primaryAction || secondaryActions || mobileActions?.length ? (
        <div className="flex shrink-0 items-center gap-[var(--space-2)] self-stretch sm:self-auto">
          {secondaryActions ? <div className="hidden items-center gap-[var(--space-2)] sm:flex">{secondaryActions}</div> : null}
          {primaryAction ? <div className="min-w-0 flex-1 sm:flex-none">{primaryAction}</div> : null}
          {mobileActions?.length ? <ActionMenu items={mobileActions} className="sm:hidden" /> : null}
        </div>
      ) : null}
    </header>
  );
}

