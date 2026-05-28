import { cn } from "@/lib/utils/cn";

export function Badge({ value, tone = "default" }: { value: string; tone?: "default" | "success" | "warning" | "danger" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-[var(--radius-full)] px-[var(--space-2)] text-[var(--text-xs)] font-medium",
        tone === "default" && "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
        tone === "brand" && "bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]",
        tone === "success" && "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
        tone === "warning" && "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
        tone === "danger" && "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
      )}
    >
      {value}
    </span>
  );
}

