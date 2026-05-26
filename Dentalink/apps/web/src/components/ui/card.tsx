import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <article className={cn("rounded-lg border border-zinc-200/60 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-200", className)}>
      {children}
    </article>
  );
}

