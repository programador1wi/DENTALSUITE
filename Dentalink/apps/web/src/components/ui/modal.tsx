import { useEffect, useId, useLayoutEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Button } from "./button";
import { cn } from "@/lib/utils/cn";

export function Modal({
  open,
  title,
  onClose,
  size = "md",
  description,
  footer,
  mobilePresentation = "dialog",
  children
}: PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
  size?: "md" | "lg" | "xl" | "2xl" | "3xl";
  description?: string;
  footer?: ReactNode;
  mobilePresentation?: "dialog" | "fullscreen" | "sheet";
}>) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const root = document.getElementById("root");
    if (root) root.inert = true;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = originalOverflow;
      if (root) root.inert = false;
      document.removeEventListener("keydown", handler);
      previousFocus?.focus();
    };
  }, [open]);

  useFocusTrap(dialogRef, open);

  if (!open) return null;

  const width =
    size === "3xl"
      ? "max-w-[1280px]"
      : size === "2xl"
        ? "max-w-[1120px]"
        : size === "xl"
          ? "max-w-[800px]"
          : size === "lg"
            ? "max-w-[640px]"
            : "max-w-[480px]";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[1500] flex justify-center bg-[var(--backdrop-modal)] p-[var(--space-2)] backdrop-blur-sm sm:items-center sm:p-[var(--space-4)]",
        mobilePresentation === "sheet" ? "items-end" : "items-center",
        mobilePresentation === "fullscreen" && "max-sm:p-0"
      )}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)] outline-none",
          width,
          mobilePresentation === "fullscreen" && "max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none",
          mobilePresentation === "sheet" && "max-sm:max-h-[92dvh] max-sm:rounded-b-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-[var(--space-4)] border-b border-[var(--border-default)] p-[var(--space-4)] sm:p-[var(--space-5)]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[var(--text-xl)] font-bold leading-tight text-[var(--text-brand-strong)]">{title}</h2>
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
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-4)] sm:p-[var(--space-5)]">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[var(--border-default)] p-[var(--space-4)] sm:px-[var(--space-5)]">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
