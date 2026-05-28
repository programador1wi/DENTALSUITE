export function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)] text-[13px] text-[var(--text-secondary)]">
      <span className="inline-block h-4 w-4 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--border-default)] border-t-[var(--text-brand)]" />
      <span>{message}</span>
    </div>
  );
}
