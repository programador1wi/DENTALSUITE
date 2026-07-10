import type { PropsWithChildren, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({
  children,
  className,
  containerClassName,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableElement> & { containerClassName?: string }>) {
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
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return (
    <thead className="border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-xs)] font-medium uppercase text-[var(--text-secondary)]" {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return <tbody className="divide-y divide-[var(--border-default)]" {...props}>{children}</tbody>;
}

export function TableRow({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) {
  return (
    <tr className={cn("group h-12 transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)]", className)} {...props}>
      {children}
    </tr>
  );
}

export function TableHeader({
  children,
  className,
  wrap = false,
  stickyLeft = false,
  stickyRight = false,
  ...props
}: PropsWithChildren<ThHTMLAttributes<HTMLTableHeaderCellElement> & { wrap?: boolean; stickyLeft?: boolean; stickyRight?: boolean }>) {
  return (
    <th
      className={cn(
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        "px-[var(--space-4)] py-[var(--space-3)] font-medium transition-colors",
        stickyLeft && "sticky left-0 z-20 bg-[var(--bg-subtle)] border-r border-[var(--border-default)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]",
        stickyRight && "sticky right-0 z-20 bg-[var(--bg-subtle)] border-l border-[var(--border-default)] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  wrap = false,
  stickyLeft = false,
  stickyRight = false,
  ...props
}: PropsWithChildren<TdHTMLAttributes<HTMLTableCellElement> & { wrap?: boolean; stickyLeft?: boolean; stickyRight?: boolean }>) {
  return (
    <td
      className={cn(
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        "px-[var(--space-4)] py-[var(--space-3)] align-middle text-[var(--text-primary)] transition-colors",
        stickyLeft && "sticky left-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] border-r border-[var(--border-default)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]",
        stickyRight && "sticky right-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-subtle)] border-l border-[var(--border-default)] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

