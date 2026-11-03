import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-6)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)]",
        className
      )}
    >
      {children}
    </article>
  );
}

