export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <span className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">
        0
      </span>
      <h4 className="mt-2 text-sm font-semibold text-slate-700">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
