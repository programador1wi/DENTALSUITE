import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, children, ...props }: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border font-medium transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-8 px-[var(--space-3)] text-[var(--text-sm)]",
        size === "md" && "h-[38px] px-[var(--space-4)] text-[var(--text-base)]",
        size === "lg" && "h-11 px-[var(--space-6)] text-[var(--text-lg)]",
        variant === "primary" && "border-[var(--action-primary)] bg-[var(--action-primary)] text-[var(--text-inverse)] hover:border-[var(--action-primary-hover)] hover:bg-[var(--action-primary-hover)]",
        variant === "secondary" && "border-[var(--border-brand)] bg-transparent text-[var(--text-brand)] hover:border-[var(--action-brand-hover)] hover:text-[var(--action-brand-hover)]",
        (variant === "danger" || variant === "destructive") && "border-[var(--text-danger)] bg-[var(--text-danger)] text-[var(--text-inverse)] hover:border-[var(--text-danger)] hover:bg-[var(--text-danger)]",
        variant === "ghost" && "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

