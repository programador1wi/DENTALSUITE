import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type PlanAction = {
  label: string;
  description?: string;
  onSelect?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
};

export type FloatingMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function PlanActionDropdown({
  id,
  label,
  icon,
  actions,
  open,
  onOpenChange
}: {
  id: string;
  label: string;
  icon: ReactNode;
  actions: PlanAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    width: 280,
    maxHeight: 560
  });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menu = menuRef.current;
      const measuredWidth = menu?.offsetWidth || 280;
      const width = Math.min(360, Math.max(280, measuredWidth));
      const maxHeight = Math.min(viewportHeight * 0.7, 560);
      const measuredHeight = Math.min(menu?.offsetHeight || maxHeight, maxHeight);
      const gap = 8;
      const padding = 8;
      const bottomTop = rect.bottom + gap;
      const topTop = rect.top - measuredHeight - gap;
      const hasBottomSpace = bottomTop + measuredHeight <= viewportHeight - padding;
      const top = hasBottomSpace ? bottomTop : Math.max(padding, topTop);
      const left = Math.min(
        Math.max(padding, rect.right - width),
        Math.max(padding, viewportWidth - width - padding)
      );
      setPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [onOpenChange, open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={label}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
            window.setTimeout(() => {
              const first = menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
              first?.focus();
            });
          }
        }}
      >
        {icon}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={`${id}-menu`}
              role="menu"
              aria-label={label}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight
              }}
              className="z-[1900] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-2xl outline-none"
              onKeyDown={(event) => {
                const buttons = Array.from(
                  menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []
                );
                const currentIndex = buttons.findIndex((button) => button === document.activeElement);
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  const nextIndex =
                    currentIndex < 0
                      ? 0
                      : (currentIndex + direction + buttons.length) % Math.max(buttons.length, 1);
                  buttons[nextIndex]?.focus();
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  buttons[0]?.focus();
                }
                if (event.key === "End") {
                  event.preventDefault();
                  buttons[buttons.length - 1]?.focus();
                }
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  title={action.disabled ? action.disabledReason : undefined}
                  className={`flex w-full flex-col px-3 py-2 text-left transition ${
                    action.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white`}
                  onClick={() => {
                    if (action.disabled) return;
                    action.onSelect?.();
                    onOpenChange(false);
                    buttonRef.current?.focus();
                  }}
                >
                  <span className="font-medium">{action.label}</span>
                  {action.disabledReason || action.description ? (
                    <span className="mt-0.5 text-xs text-slate-400">
                      {action.disabled ? action.disabledReason : action.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
