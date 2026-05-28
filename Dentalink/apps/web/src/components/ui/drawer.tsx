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
    <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-[var(--bg-surface)] p-[var(--space-6)] shadow-[var(--shadow-modal)]">
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-4)]">
          <h3 className="text-[var(--text-xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
