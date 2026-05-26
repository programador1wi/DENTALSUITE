import { cn } from "@/lib/utils/cn";

export function Badge({ value, tone = "default" }: { value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset",
        tone === "default" && "bg-slate-50 text-slate-600 ring-slate-500/10",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
        tone === "warning" && "bg-amber-50 text-amber-800 ring-amber-600/10",
        tone === "danger" && "bg-rose-50 text-rose-700 ring-rose-600/10"
      )}
    >
      {value}
    </span>
  );
}

