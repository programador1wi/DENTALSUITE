import type { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export function Modal({
  open,
  title,
  onClose,
  size = "md",
  children
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void; size?: "md" | "lg" | "xl" | "2xl" }>) {
  if (!open) return null;

  const width = size === "2xl" ? "max-w-[1120px]" : size === "xl" ? "max-w-[800px]" : size === "lg" ? "max-w-[640px]" : "max-w-[480px]";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-[var(--space-4)] backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--bg-surface)] p-[var(--space-6)] shadow-[var(--shadow-modal)] ${width}`}>
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-4)]">
          <h3 className="text-[var(--text-xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

