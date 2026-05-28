export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-[var(--space-6)] text-center">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-subtle)] text-[13px] font-medium text-[var(--text-secondary)]">
        0
      </span>
      <h4 className="mt-[var(--space-3)] text-[15px] font-semibold text-[var(--text-primary)]">{title}</h4>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
