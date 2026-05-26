import type { PropsWithChildren } from "react";

export function Table({ children }: PropsWithChildren) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm text-slate-600">{children}</table>
    </div>
  );
}

export function TableHead({ children }: PropsWithChildren) {
  return <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">{children}</thead>;
}

export function TableBody({ children }: PropsWithChildren) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TableRow({ children }: PropsWithChildren) {
  return <tr className="hover:bg-slate-50/40 transition-colors duration-150">{children}</tr>;
}

export function TableHeader({ children }: PropsWithChildren) {
  return <th className="px-4 py-3.5 font-bold text-slate-500 whitespace-nowrap">{children}</th>;
}

export function TableCell({ children }: PropsWithChildren) {
  return <td className="px-4 py-3.5 text-slate-600 align-middle whitespace-nowrap">{children}</td>;
}

