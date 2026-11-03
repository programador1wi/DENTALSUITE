import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

export function ActionMenu({
  items,
  label = "Más acciones",
  align = "right",
  className,
  triggerIcon,
  size = "md",
  buttonClassName
}: {
  items: ActionMenuItem[];
  label?: string;
  align?: "left" | "right";
  className?: string;
  triggerIcon?: ReactNode;
  size?: "sm" | "md";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const menuEstimatedHeight = items.length * 42 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isUp = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    const top = isUp ? Math.max(8, rect.top - menuEstimatedHeight - 4) : rect.bottom + 4;

    if (align === "right") {
      const right = Math.max(8, window.innerWidth - rect.right);
      setCoords({ top, right });
    } else {
      const left = Math.max(8, rect.left);
      setCoords({ top, left });
    }
  }, [align, items.length]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!items.length) return null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[var(--duration-fast)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
          size === "sm" ? "h-8 w-8" : "h-[38px] w-[38px]",
          buttonClassName
        )}
      >
        {triggerIcon ?? <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
      </button>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="fixed z-[9999] min-w-56 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-1)] shadow-[var(--shadow-modal)] ring-1 ring-black/[0.04] animate-in fade-in-0 zoom-in-95"
              style={{
                top: `${coords.top}px`,
                ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
                ...(coords.left !== undefined ? { left: `${coords.left}px` } : {})
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-sm)] font-medium transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-40",
                    item.destructive
                      ? "text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                  )}
                >
                  {item.icon ? <span className="shrink-0" aria-hidden="true">{item.icon}</span> : null}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
