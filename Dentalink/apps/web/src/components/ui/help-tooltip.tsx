import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TooltipPlacement = "top" | "bottom" | "left" | "right";
type TooltipPosition = TooltipPlacement | "auto";

type TooltipCoordinates = {
  arrowLeft?: number;
  arrowTop?: number;
  left: number;
  placement: TooltipPlacement;
  top: number;
};

type HelpTooltipProps = {
  children?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  label?: string;
  position?: TooltipPosition;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

const VIEWPORT_PADDING = 12;
const TOOLTIP_GAP = 10;
const ARROW_PADDING = 16;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function placementOrder(position: TooltipPosition): TooltipPlacement[] {
  if (position === "auto") return ["top", "bottom", "right", "left"];

  const opposite: Record<TooltipPlacement, TooltipPlacement> = {
    bottom: "top",
    left: "right",
    right: "left",
    top: "bottom"
  };
  const secondary: TooltipPlacement[] = position === "left" || position === "right" ? ["top", "bottom"] : ["right", "left"];

  return [position, opposite[position], ...secondary.filter((placement) => placement !== position && placement !== opposite[position])];
}

function candidateCoordinates(triggerRect: DOMRect, tooltipRect: DOMRect, placement: TooltipPlacement) {
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  if (placement === "top") {
    return {
      left: triggerCenterX - tooltipRect.width / 2,
      top: triggerRect.top - tooltipRect.height - TOOLTIP_GAP
    };
  }

  if (placement === "bottom") {
    return {
      left: triggerCenterX - tooltipRect.width / 2,
      top: triggerRect.bottom + TOOLTIP_GAP
    };
  }

  if (placement === "left") {
    return {
      left: triggerRect.left - tooltipRect.width - TOOLTIP_GAP,
      top: triggerCenterY - tooltipRect.height / 2
    };
  }

  return {
    left: triggerRect.right + TOOLTIP_GAP,
    top: triggerCenterY - tooltipRect.height / 2
  };
}

function fitsMainAxis(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
  viewportWidth: number,
  viewportHeight: number
) {
  const candidate = candidateCoordinates(triggerRect, tooltipRect, placement);

  if (placement === "top") return candidate.top >= VIEWPORT_PADDING;
  if (placement === "bottom") return candidate.top + tooltipRect.height <= viewportHeight - VIEWPORT_PADDING;
  if (placement === "left") return candidate.left >= VIEWPORT_PADDING;

  return candidate.left + tooltipRect.width <= viewportWidth - VIEWPORT_PADDING;
}

export function calculateTooltipPosition({
  position,
  tooltipRect,
  triggerRect,
  viewportHeight,
  viewportWidth
}: {
  position: TooltipPosition;
  tooltipRect: DOMRect;
  triggerRect: DOMRect;
  viewportHeight: number;
  viewportWidth: number;
}): TooltipCoordinates {
  const placements = placementOrder(position);
  const placement = placements.find((item) => fitsMainAxis(triggerRect, tooltipRect, item, viewportWidth, viewportHeight)) ?? placements[0];
  const candidate = candidateCoordinates(triggerRect, tooltipRect, placement);
  const left = clamp(candidate.left, VIEWPORT_PADDING, viewportWidth - tooltipRect.width - VIEWPORT_PADDING);
  const top = clamp(candidate.top, VIEWPORT_PADDING, viewportHeight - tooltipRect.height - VIEWPORT_PADDING);
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  return {
    arrowLeft:
      placement === "top" || placement === "bottom"
        ? clamp(triggerCenterX - left, ARROW_PADDING, tooltipRect.width - ARROW_PADDING)
        : undefined,
    arrowTop:
      placement === "left" || placement === "right"
        ? clamp(triggerCenterY - top, ARROW_PADDING, tooltipRect.height - ARROW_PADDING)
        : undefined,
    left,
    placement,
    top
  };
}

export function HelpTooltip({
  children,
  content,
  disabled = false,
  label = "Ayuda del sistema",
  position = "auto",
  triggerClassName,
  triggerStyle
}: HelpTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coordinates, setCoordinates] = useState<TooltipCoordinates | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    setCoordinates(
      calculateTooltipPosition({
        position,
        tooltipRect: tooltip.getBoundingClientRect(),
        triggerRect: trigger.getBoundingClientRect(),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth
      })
    );
  }, [position]);

  const close = useCallback(() => {
    setOpen(false);
    setCoordinates(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [close, open, updatePosition]);

  let isSuppressed = false;
  if (typeof document !== "undefined") {
    const overlays = Array.from(
      document.querySelectorAll('.backdrop-blur-sm, [role="dialog"], [role="menu"]')
    );
    if (overlays.length > 0) {
      const trigger = triggerRef.current;
      const isInsideActiveOverlay = trigger ? overlays.some((overlay) => overlay.contains(trigger)) : false;
      if (!isInsideActiveOverlay) {
        isSuppressed = true;
      }
    }
  }

  const shouldRenderTooltip = open && !isSuppressed;
  const describedBy = shouldRenderTooltip ? tooltipId : undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": describedBy
      })
    : children;

  if (disabled || !content) {
    return children ? <>{children}</> : null;
  }

  const tooltipStyle: CSSProperties = coordinates
    ? {
        left: coordinates.left,
        top: coordinates.top,
        visibility: "visible"
      }
    : {
        left: 0,
        top: 0,
        visibility: "hidden"
      };

  const arrowStyle: CSSProperties =
    coordinates?.placement === "top" || coordinates?.placement === "bottom"
      ? { left: coordinates.arrowLeft }
      : { top: coordinates?.arrowTop };

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-flex shrink-0 items-center", children ? "cursor-help" : "align-middle", triggerClassName)}
        style={triggerStyle}
        onBlur={close}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={close}
      >
        {children ? (
          child
        ) : (
          <button
            type="button"
            aria-describedby={describedBy}
            aria-label={label}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none focus-visible:bg-emerald-50 focus-visible:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
          >
            <CircleHelp className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        )}
      </span>

      {shouldRenderTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[1200] max-w-[320px] rounded-[var(--radius-md)] border border-slate-200 bg-white px-3 py-2.5 text-left text-[13px] font-medium leading-[1.45] text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/[0.03] motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out"
              style={tooltipStyle}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute h-2.5 w-2.5 rotate-45 border border-slate-200 bg-white",
                  coordinates?.placement === "top" && "-bottom-[5px] -translate-x-1/2 border-l-0 border-t-0",
                  coordinates?.placement === "bottom" && "-top-[5px] -translate-x-1/2 border-b-0 border-r-0",
                  coordinates?.placement === "left" && "-right-[5px] -translate-y-1/2 border-b-0 border-l-0",
                  coordinates?.placement === "right" && "-left-[5px] -translate-y-1/2 border-r-0 border-t-0"
                )}
                style={arrowStyle}
              />
              <div className="relative z-10 whitespace-normal break-words">{content}</div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
