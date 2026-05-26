import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400/80 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/10 transition-all duration-150",
        className
      )}
      {...props}
    />
  );
}
