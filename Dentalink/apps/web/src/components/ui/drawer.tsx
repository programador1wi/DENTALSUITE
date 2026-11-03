import { useEffect, useId, useRef, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";

export function Drawer({
  open,
  title,
  onClose,
  description,
  placement = "right",
  size = "md",
  children
}: PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
  description?: string;
  placement?: "left" | "right" | "bottom";
  size?: "sm" | "md" | "lg";
}>) {
  const titleId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    const root = document.getElementById("root");
    if (root) root.inert = true;
    
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const previousFocus = document.activeElement as HTMLElement;
    setTimeout(() => drawerRef.current?.focus(), 10);

    return () => {
      document.body.style.overflow = originalOverflow;
      if (root) root.inert = false;
      document.removeEventListener("keydown", handler);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  useFocusTrap(drawerRef, open);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1500] bg-[var(--backdrop-modal)] backdrop-blur-sm" onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute flex max-h-full w-full flex-col overflow-hidden bg-[var(--bg-surface)] shadow-[var(--shadow-modal)] outline-none transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)]",
          placement === "left" && "left-0 top-0 h-full",
          placement === "right" && "right-0 top-0 h-full",
          placement === "bottom" && "bottom-0 left-0 max-h-[92dvh] rounded-t-[var(--radius-xl)]",
          placement !== "bottom" && size === "sm" && "max-w-sm",
          placement !== "bottom" && size === "md" && "max-w-xl",
          placement !== "bottom" && size === "lg" && "max-w-3xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-[var(--space-4)] border-b border-[var(--border-default)] p-[var(--space-4)] sm:p-[var(--space-6)]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[var(--text-xl)] font-semibold leading-tight text-[var(--text-brand-strong)]">{title}</h2>
            {description ? <p className="mt-[var(--space-1)] text-[var(--text-sm)] text-[var(--text-secondary)]">{description}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 p-0"
            style={{ height: 40, minHeight: 40, minWidth: 40, padding: 0, width: 40 }}
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-4)] sm:p-[var(--space-6)]">{children}</div>
      </div>
    </div>,
    document.body
  );
}
