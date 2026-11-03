import { Check } from "lucide-react";

export function SuccessState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--status-success-bg)] bg-[var(--status-success-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--status-success-text)]" role="status" aria-live="polite">
      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
