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
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {helpText && <HelpTooltip content={helpText} />}
      </div>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}

