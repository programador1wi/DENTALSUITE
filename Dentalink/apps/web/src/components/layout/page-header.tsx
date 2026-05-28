import { HelpTooltip } from "@/components/ui/help-tooltip";

export function PageHeader({ 
  title, 
  description,
  helpText 
}: { 
  title: string; 
  description?: string; 
  helpText?: string;
}) {
  return (
    <div className="mb-[var(--space-6)]">
      <div className="flex items-center gap-2">
        <h2 className="text-[var(--text-2xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{title}</h2>
        {helpText && <HelpTooltip content={helpText} />}
      </div>
      {description ? <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{description}</p> : null}
    </div>
  );
}

