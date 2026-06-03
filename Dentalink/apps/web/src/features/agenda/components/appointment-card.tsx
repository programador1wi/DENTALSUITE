import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { appointmentColorPalette, appointmentStatusLabel } from "./appointment-status";
import { AppointmentActionsMenu, type AppointmentMenuAction } from "./appointment-actions-menu";
import { AppointmentStatusMenu } from "./appointment-status-menu";

type AppointmentCardProps = {
  appointment: Appointment;
  compact?: boolean;
  onEdit: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment, cancelledBy?: "patient" | "clinic") => void;
  onReschedule?: (appointment: Appointment) => void;
  onChangeStatus?: (appointment: Appointment, status: AppointmentStatus) => void;
  onConfirm?: (id: string) => void;
  onArrive?: (id: string) => void;
  onWaitingRoom?: (id: string) => void;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  onNoShow?: (id: string) => void;
  onMenuAction?: (appointment: Appointment, action: AppointmentMenuAction) => void;
};

export function AppointmentCard({
  appointment,
  compact = false,
  onEdit,
  onCancel,
  onReschedule,
  onChangeStatus,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow,
  onMenuAction
}: AppointmentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Bloqueo Clinico";
  const patientId = appointment.patient?.id || "N/A";
  const patientFirstName = patientName.split(" ")[0] || patientName;
  const patientLastName = appointment.patient?.lastName.split(" ")[0] ?? "";
  const palette = appointmentColorPalette[appointment.status] || appointmentColorPalette.SCHEDULED;

  const handleMenuAction = (action: AppointmentMenuAction) => {
    if (action === "changeDate") {
      onReschedule?.(appointment);
      return;
    }

    if (action === "cancel") {
      onCancel?.(appointment, "clinic");
      return;
    }

    if (!onMenuAction && (action === "modifyDuration" || action === "addComment" || action === "changeStatus")) {
      onEdit(appointment);
      return;
    }

    onMenuAction?.(appointment, action);
  };

  if (compact) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full cursor-pointer flex-col justify-start rounded-[var(--radius-sm)] border p-[var(--space-1)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:shadow-[var(--shadow-card-hover)]",
          menuOpen ? "z-[80] overflow-visible" : "z-0 overflow-hidden",
          palette.cardClass
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => onEdit(appointment)}
      >
        <div className={cn("flex h-full w-full items-center justify-between gap-1", menuOpen ? "overflow-visible" : "overflow-hidden")}>
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[var(--radius-full)] ring-1 ring-[var(--bg-surface)]", palette.dotClass)} />

          <span className="flex-1 truncate text-[10px] font-semibold leading-tight text-[var(--text-primary)]">
            ({patientId.slice(0, 5)}) {patientFirstName} {patientLastName}
          </span>

          <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
            <MessageSquare className="h-3 w-3 text-[var(--text-brand)]" />
            <AppointmentActionsMenu
              appointment={appointment}
              triggerVariant="compact"
              placement="auto"
              onOpenChange={(open) => {
                setMenuOpen(open);
                if (open) setShowTooltip(false);
              }}
              onAction={handleMenuAction}
            />
          </div>
        </div>

        {showTooltip && !menuOpen && (
          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-2)] shadow-[var(--shadow-card-hover)] animate-in fade-in-0 zoom-in-95">
            <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border-default)] bg-[var(--bg-surface)]" />

            <div className="relative z-10 flex flex-col gap-0.5">
              <div className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)]">
                {appointment.title.toUpperCase()} <span className="font-normal text-[var(--text-secondary)]">({appointment.chair?.name || "BOX 1"})</span>
              </div>
              <div className="mb-[var(--space-2)] border-b border-[var(--border-default)] pb-[var(--space-1)] text-[var(--text-xs)] text-[var(--text-secondary)]">
                {appointmentStatusLabel(appointment.status)}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-primary)]">
                ({patientId.slice(0, 5)}) {patientName.toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <article
      className={cn(
        "relative flex h-full flex-col justify-between rounded-[var(--radius-lg)] border p-[var(--space-4)] text-[var(--text-xs)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]",
        menuOpen ? "z-[80] overflow-visible" : "z-0",
        palette.cardClass
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="whitespace-nowrap text-[9px] font-medium text-[var(--text-secondary)]">
            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h4 className="truncate font-semibold leading-tight text-[var(--text-primary)]">{appointment.title}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <AppointmentStatusMenu
            appointment={appointment}
            variant="card"
            onChangeStatus={onChangeStatus}
            onConfirm={onConfirm}
            onArrive={onArrive}
            onWaitingRoom={onWaitingRoom}
            onStart={onStart}
            onComplete={onComplete}
            onNoShow={onNoShow}
            onReschedule={onReschedule}
            onCancel={onCancel}
            onHistory={onMenuAction ? (item) => onMenuAction(item, "viewHistory") : undefined}
          />
          <AppointmentActionsMenu
            appointment={appointment}
            triggerVariant="standard"
            placement="auto"
            onOpenChange={setMenuOpen}
            onAction={handleMenuAction}
          />
        </div>
      </div>

      <div className="mt-[var(--space-3)] space-y-1.5 text-[var(--text-xs)] font-normal text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Paciente:</span>
          <span className="truncate font-semibold text-[var(--text-primary)]">{patientName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Doctor:</span>
          <span className="truncate text-[var(--text-primary)]">
            {appointment.professional.firstName} {appointment.professional.lastName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Sillon:</span>
          <span className="truncate text-[var(--text-secondary)]">
            {appointment.branch.name}
            {appointment.chair ? ` - ${appointment.chair.name}` : ""}
          </span>
        </div>
      </div>
    </article>
  );
}
