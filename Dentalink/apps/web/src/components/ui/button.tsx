import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border font-medium transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-8 px-[var(--space-3)] text-[var(--text-sm)]",
        size === "md" && "h-10 px-[var(--space-4)] text-[var(--text-sm)]",
        size === "lg" && "h-11 px-[var(--space-6)] text-[var(--text-lg)]",
        variant === "primary" && "border-[var(--action-primary)] bg-[var(--action-primary)] text-white hover:border-[var(--action-primary-hover)] hover:bg-[var(--action-primary-hover)] shadow-xs",
        variant === "secondary" && "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--color-base-slate-500)] hover:text-[var(--text-brand-strong)] shadow-xs",
        (variant === "danger" || variant === "destructive") && "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 shadow-xs",
        variant === "ghost" && "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

