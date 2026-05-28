export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] p-[var(--space-4)] text-[var(--text-sm)] text-[var(--status-danger-text)]">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-full)] border border-[var(--text-danger)] text-[10px]">
          !
        </span>
        Error
      </div>
      <p className="mt-1">{message}</p>
    </div>
  );
}
