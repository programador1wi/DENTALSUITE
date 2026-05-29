import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import type { Appointment } from "../services/appointments.service";

export type AppointmentMenuAction =
  | "requestDataEmail"
  | "modifyDuration"
  | "addComment"
  | "changeDate"
  | "changeStatus"
  | "notifyEmail"
  | "viewHistory"
  | "cancel";

type TriggerVariant = "compact" | "standard" | "list";
type Placement = "bottom" | "top" | "auto";

export function AppointmentActionsMenu({
  appointment,
  triggerVariant = "compact",
  placement = "auto",
  onAction,
  onOpenChange
}: {
  appointment: Appointment;
  triggerVariant?: TriggerVariant;
  placement?: Placement;
  onAction?: (action: AppointmentMenuAction) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasPatient = Boolean(appointment.patientId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      closeMenu();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const closeMenu = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  const toggleMenu = (button: HTMLButtonElement) => {
    const nextOpen = !open;

    if (nextOpen) {
      const rect = button.getBoundingClientRect();
      const menuHeight = 344;
      setOpenUp(placement === "top" || (placement === "auto" && rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight));
    }

    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const goToPatientRoute = (path: string) => {
    if (!appointment.patientId) return;
    navigate(path);
    closeMenu();
  };

  const handleAction = (action: AppointmentMenuAction) => {
    closeMenu();
    onAction?.(action);
  };

  const copyDataRequestLink = async () => {
    if (!appointment.patientId) return;

    const link = `${window.location.origin}/patients/${appointment.patientId}/profile`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Link copiado");
    }

    closeMenu();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acciones de cita"
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu(event.currentTarget);
        }}
        className={cn(
          "flex items-center justify-center transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] active:scale-95",
          triggerVariant === "compact" &&
            "rounded-[var(--radius-full)] bg-[var(--bg-subtle)] p-0.5 text-[var(--text-primary)] hover:bg-[var(--border-default)]",
          triggerVariant === "standard" &&
            "h-5 w-5 rounded-[var(--radius-sm)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
          triggerVariant === "list" &&
            "h-7 w-7 rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        )}
      >
        {triggerVariant === "list" ? <MoreVertical className="h-3.5 w-3.5" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-[1000] w-[204px] overflow-hidden rounded-[4px] border border-[#d7d7d7] bg-white py-1 text-[11px] font-normal leading-none text-[#3f3f46] shadow-[0_8px_22px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.02] animate-in fade-in-0 zoom-in-95",
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <ActionItem disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/treatments`)}>
            Ir a plan de tratamiento
          </ActionItem>
          <ActionItem disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/payments`)}>
            Cobranza
          </ActionItem>
          <ActionItem disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/profile`)}>
            Datos personales
          </ActionItem>
          <ActionItem disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/clinical`)}>
            Ir a la ficha clinica del paciente
          </ActionItem>
          <ActionItem disabled={!hasPatient} onClick={() => handleAction("requestDataEmail")}>
            Enviar solicitud de datos por mail
          </ActionItem>
          <ActionItem disabled={!hasPatient} onClick={() => void copyDataRequestLink()}>
            Copiar link para solicitar datos
          </ActionItem>

          <div className="my-1 border-t border-[#e5e7eb]" />

          <ActionItem onClick={() => handleAction("modifyDuration")}>Modificar duracion</ActionItem>
          <ActionItem onClick={() => handleAction("addComment")}>Agregar comentario</ActionItem>
          <ActionItem onClick={() => handleAction("changeDate")}>Cambiar fecha</ActionItem>
          <ActionItem onClick={() => handleAction("changeStatus")}>Cambiar estado</ActionItem>
          <ActionItem onClick={() => handleAction("notifyEmail")}>Notificar por e-mail</ActionItem>
          <ActionItem onClick={() => handleAction("viewHistory")}>Ver historial de cambios</ActionItem>
          <ActionItem onClick={() => handleAction("cancel")}>Anular</ActionItem>
        </div>
      )}
    </div>
  );
}

function ActionItem({
  children,
  disabled,
  onClick
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="block h-6 w-full px-4 text-left text-[11px] font-normal leading-6 text-[#3f3f46] transition-colors hover:bg-[#f3f4f6] focus:bg-[#f3f4f6] focus:outline-none disabled:cursor-not-allowed disabled:text-[#a1a1aa] disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
