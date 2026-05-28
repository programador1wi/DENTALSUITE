import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({
  children,
  className,
  containerClassName
}: PropsWithChildren<{ className?: string; containerClassName?: string }>) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)]",
        containerClassName
      )}
    >
      <table
        className={cn(
          "min-w-full border-collapse text-left text-[var(--text-sm)] text-[var(--text-primary)]",
          className
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: PropsWithChildren) {
  return (
    <thead className="border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-xs)] font-medium uppercase text-[var(--text-secondary)]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: PropsWithChildren) {
  return <tbody className="divide-y divide-[var(--border-default)]">{children}</tbody>;
}

export function TableRow({ children }: PropsWithChildren) {
  return (
    <tr className="h-12 transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)]">
      {children}
    </tr>
  );
}

export function TableHeader({
  children,
  className,
  wrap = false
}: PropsWithChildren<{ className?: string; wrap?: boolean }>) {
  return (
    <th
      className={cn(
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        "px-[var(--space-4)] py-[var(--space-3)] font-medium",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  wrap = false
}: PropsWithChildren<{ className?: string; wrap?: boolean }>) {
  return (
    <td
      className={cn(
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        "px-[var(--space-4)] py-[var(--space-3)] align-middle text-[var(--text-primary)]",
        className
      )}
    >
      {children}
    </td>
  );
}
