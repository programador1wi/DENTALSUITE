import { useEffect, useMemo, useRef, useState } from "react";
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
  onCancel?: (appointment: Appointment, cancelledBy?: "patient" | "clinic") => void;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleMenu = () => {
    if (!canOpen) return;
    const nextOpen = !open;
    if (nextOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = Math.min(320, 40 + menuItems.length * 32);
      setOpenUp(rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight);
    }
    setOpen(nextOpen);
  };

  const executeAction = (item: AppointmentStatusMenuItem) => {
    setOpen(false);
    switch (item.action) {
      case "markPendingConfirmation":
      case "markScheduled":
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

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-[1000] w-[232px] overflow-hidden rounded-[4px] border border-[#d7d7d7] bg-white py-1 text-[11px] font-normal leading-none text-[#3f3f46] shadow-[0_8px_22px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.02] animate-in fade-in-0 zoom-in-95",
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          )}
        >
          {menuItems.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              onClick={() => executeAction(item)}
              className={cn(
                "block h-8 w-full px-3 text-left text-[11px] font-medium leading-8 transition-colors hover:bg-[#f3f4f6] focus:bg-[#f3f4f6] focus:outline-none",
                item.tone === "success" && "text-emerald-700",
                item.tone === "warning" && "text-amber-700",
                item.tone === "danger" && "text-red-700",
                item.tone === "brand" && "text-blue-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
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
      return Boolean(handlers.onCancel);
    case "history":
      return Boolean(handlers.onHistory);
  }
}
