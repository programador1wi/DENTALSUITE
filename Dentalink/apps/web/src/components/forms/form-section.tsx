import type { PropsWithChildren } from "react";

export function FormSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)]">
      <h3 className="mb-[var(--space-4)] text-[17px] font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="space-y-[var(--space-4)]">{children}</div>
    </section>
  );
}
