import { X } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function OnlineSchedulingDrawer({
  children,
  footer,
  onClose,
  open,
  title
}: PropsWithChildren<{
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/25">
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 border-t-4 border-t-slate-800 px-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button type="button" variant="secondary" className="h-8 w-8 p-0" onClick={onClose} title="Cerrar" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}
