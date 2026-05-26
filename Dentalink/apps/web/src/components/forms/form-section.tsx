import type { PropsWithChildren } from "react";

export function FormSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
