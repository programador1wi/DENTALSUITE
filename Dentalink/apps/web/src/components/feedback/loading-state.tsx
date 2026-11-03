export function LoadingState({
  message = "Cargando...",
  variant = "inline",
  rows = 3
}: {
  message?: string;
  variant?: "inline" | "skeleton";
  rows?: number;
}) {
  if (variant === "skeleton") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)]" aria-busy="true" aria-label={message}>
        <span className="sr-only">{message}</span>
        <div className="space-y-[var(--space-3)]">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-secondary)]" role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--border-default)] border-t-[var(--text-brand)]" />
      <span>{message}</span>
    </div>
  );
}
