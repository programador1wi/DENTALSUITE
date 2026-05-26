import type { PropsWithChildren } from "react";
import { Button } from "./button";

export function Drawer({
  open,
  title,
  onClose,
  children
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
