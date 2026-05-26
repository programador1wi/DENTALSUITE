export function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      <span>{message}</span>
    </div>
  );
}
