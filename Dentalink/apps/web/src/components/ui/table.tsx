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
        "w-full overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]",
        containerClassName
      )}
    >
      <table
        className={cn(
          "w-full min-w-full border-collapse text-left text-[var(--text-sm)] text-[var(--text-primary)]",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return (
    <thead className={cn("border-b border-slate-200 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wider text-slate-500 [&>tr]:hover:bg-transparent", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return <tbody className={cn("divide-y divide-slate-100 bg-white", className)} {...props}>{children}</tbody>;
}

export function TableRow({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) {
  return (
    <tr className={cn("group transition-colors duration-150 hover:bg-slate-50/80 focus-within:bg-[var(--bg-brand-light)]/40", className)} {...props}>
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
        "px-4 py-3.5 align-middle text-left text-xs font-bold uppercase tracking-wider text-slate-500",
        stickyLeft && "sticky left-0 z-20 border-r border-slate-200 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(4,44,83,0.08)]",
        stickyRight && "sticky right-0 z-20 border-l border-slate-200 bg-slate-50 shadow-[-2px_0_5px_-2px_rgba(4,44,83,0.08)]",
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
        "px-4 py-3.5 align-middle leading-normal text-slate-700 transition-colors",
        stickyLeft && "sticky left-0 z-10 border-r border-slate-200 bg-white shadow-[2px_0_5px_-2px_rgba(4,44,83,0.06)] group-hover:bg-slate-50/80",
        stickyRight && "sticky right-0 z-10 border-l border-slate-200 bg-white shadow-[-2px_0_5px_-2px_rgba(4,44,83,0.06)] group-hover:bg-slate-50/80",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
