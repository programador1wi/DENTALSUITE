import { cn } from "@/lib/utils/cn";

export function Badge({
  value,
  tone = "default",
  dot = false,
  className
}: {
  value: string;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-full)] px-2.5 text-[11px] font-medium leading-none transition-colors",
        tone === "default" && "bg-slate-100 text-slate-700 border border-slate-200/60",
        tone === "brand" && "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold",
        tone === "success" && "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
        tone === "warning" && "bg-amber-50 text-amber-700 border border-amber-200/60",
        tone === "danger" && "bg-rose-50 text-rose-700 border border-rose-200/60",
        className
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            tone === "default" && "bg-slate-400",
            tone === "brand" && "bg-emerald-600",
            tone === "success" && "bg-emerald-500",
            tone === "warning" && "bg-amber-500",
            tone === "danger" && "bg-rose-500"
          )}
        />
      ) : null}
      {value}
    </span>
  );
}

