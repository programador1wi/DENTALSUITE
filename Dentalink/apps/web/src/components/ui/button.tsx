import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100",
        size === "sm" ? "px-2.5 py-1.5" : "px-4 py-2",
        variant === "primary" && "bg-zinc-900 text-white border border-zinc-900/10 hover:bg-zinc-800 shadow-sm",
        variant === "secondary" && "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 shadow-sm",
        variant === "danger" && "bg-red-600 text-white border border-red-700/10 hover:bg-red-700 shadow-sm",
        variant === "ghost" && "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

