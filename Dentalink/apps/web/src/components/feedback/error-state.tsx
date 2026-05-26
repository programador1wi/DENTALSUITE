export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-300 text-[10px]">
          !
        </span>
        Error
      </div>
      <p className="mt-1">{message}</p>
    </div>
  );
}
