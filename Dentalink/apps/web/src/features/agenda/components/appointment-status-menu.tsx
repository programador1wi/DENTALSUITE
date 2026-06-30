import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { getAppointmentStatusMenuItems, type AppointmentStatusMenuItem } from "../utils/appointment-status-flow";
import { appointmentColorPalette, appointmentStatusLabel } from "./appointment-status";

type AppointmentStatusMenuProps = {
  appointment: Appointment;
  variant?: "list" | "card";
  onChangeStatus?: (appointment: Appointment, status: AppointmentStatus) => void;
  onConfirm?: (id: string) => void;
  onArrive?: (id: string) => void;
  onWaitingRoom?: (id: string) => void;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  onNoShow?: (id: string) => void;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment, cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled") => void;
  onHistory?: (appointment: Appointment) => void;
};

export function AppointmentStatusMenu({
  appointment,
  variant = "card",
  onChangeStatus,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow,
  onReschedule,
  onCancel,
  onHistory
}: AppointmentStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const palette = appointmentColorPalette[appointment.status] ?? appointmentColorPalette.SCHEDULED;
  const menuItems = useMemo(
    () => getAppointmentStatusMenuItems(appointment.status).filter((item) => canRunStatusAction(item, {
      onChangeStatus,
      onConfirm,
      onArrive,
      onWaitingRoom,
      onStart,
      onComplete,
      onNoShow,
      onReschedule,
      onCancel,
      onHistory
    })),
    [appointment.status, onArrive, onCancel, onChangeStatus, onComplete, onConfirm, onHistory, onNoShow, onReschedule, onStart, onWaitingRoom]
  );
  const canOpen = menuItems.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current?.contains(event.target as Node) ||
        menuRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("scroll", () => setOpen(false), { capture: true });
      window.addEventListener("resize", () => setOpen(false));
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", () => setOpen(false), { capture: true });
      window.removeEventListener("resize", () => setOpen(false));
    };
  }, [open]);

  const toggleMenu = () => {
    if (!canOpen) return;
    const nextOpen = !open;
    if (nextOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = Math.min(320, 8 + menuItems.length * 32);
      const menuWidth = 232;
      const isUp = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
      setOpenUp(isUp);

      const top = isUp ? rect.top - menuHeight - 4 + window.scrollY : rect.bottom + 4 + window.scrollY;
      const left = Math.max(12, rect.right - menuWidth + window.scrollX);
      setCoords({ top, left });
    }
    setOpen(nextOpen);
  };

  const executeAction = (item: AppointmentStatusMenuItem) => {
    setOpen(false);
    switch (item.action) {
      case "markPendingConfirmation":
      case "markScheduled":
      case "confirmWhatsApp":
      case "confirmPhone":
      case "confirmEmail":
      case "notifyWhatsApp":
      case "notifyEmail":
        if (item.nextStatus) onChangeStatus?.(appointment, item.nextStatus);
        break;
      case "confirm":
        onConfirm?.(appointment.id);
        break;
      case "arrive":
        onArrive?.(appointment.id);
        break;
      case "waitingRoom":
        onWaitingRoom?.(appointment.id);
        break;
      case "start":
        onStart?.(appointment.id);
        break;
      case "complete":
        onComplete?.(appointment.id);
        break;
      case "noShow":
        onNoShow?.(appointment.id);
        break;
      case "reschedule":
        onReschedule?.(appointment);
        break;
      case "cancelPatient":
        onCancel?.(appointment, "patient");
        break;
      case "cancelClinic":
        onCancel?.(appointment, "clinic");
        break;
      case "cancelConflict":
        onCancel?.(appointment, "conflict");
        break;
      case "cancelRescheduled":
        onCancel?.(appointment, "rescheduled");
        break;
      case "history":
        onHistory?.(appointment);
        break;
    }
  };

  return (
    <div className="relative inline-flex" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        disabled={!canOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-default",
          palette.cardClass,
          variant === "list" ? "px-2.5 py-1 text-[10px]" : "px-2 py-0.5 text-[10px]"
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", palette.dotClass)} />
        <span className="truncate">{appointmentStatusLabel(appointment.status)}</span>
        {canOpen ? <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} /> : null}
      </button>

      {open && coords && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="absolute z-[1000] w-[232px] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 text-[11px] font-normal leading-none text-[var(--text-primary)] shadow-[var(--shadow-modal)] ring-1 ring-black/[0.02] animate-in fade-in-0 zoom-in-95"
          style={{
            top: coords.top,
            left: coords.left
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              onClick={() => executeAction(item)}
              className={cn(
                "block h-8 w-full px-3 text-left text-[11px] font-medium leading-8 transition-colors hover:bg-[var(--bg-subtle)] focus:bg-[var(--bg-subtle)] focus:outline-none",
                item.tone === "success" && "text-[var(--text-success)]",
                item.tone === "warning" && "text-[var(--text-warning)]",
                item.tone === "danger" && "text-[var(--text-danger)]",
                item.tone === "brand" && "text-[var(--text-brand)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function canRunStatusAction(
  item: AppointmentStatusMenuItem,
  handlers: Pick<
    AppointmentStatusMenuProps,
    | "onChangeStatus"
    | "onConfirm"
    | "onArrive"
    | "onWaitingRoom"
    | "onStart"
    | "onComplete"
    | "onNoShow"
    | "onReschedule"
    | "onCancel"
    | "onHistory"
  >
) {
  switch (item.action) {
    case "markPendingConfirmation":
    case "markScheduled":
    case "confirmWhatsApp":
    case "confirmPhone":
    case "confirmEmail":
    case "notifyWhatsApp":
    case "notifyEmail":
      return Boolean(handlers.onChangeStatus);
    case "confirm":
      return Boolean(handlers.onConfirm);
    case "arrive":
      return Boolean(handlers.onArrive);
    case "waitingRoom":
      return Boolean(handlers.onWaitingRoom);
    case "start":
      return Boolean(handlers.onStart);
    case "complete":
      return Boolean(handlers.onComplete);
    case "noShow":
      return Boolean(handlers.onNoShow);
    case "reschedule":
      return Boolean(handlers.onReschedule);
    case "cancelPatient":
    case "cancelClinic":
    case "cancelConflict":
    case "cancelRescheduled":
      return Boolean(handlers.onCancel);
    case "history":
      return Boolean(handlers.onHistory);
  }
}
