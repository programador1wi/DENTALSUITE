import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { appointmentColorPalette, appointmentStatusLabel } from "./appointment-status";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { AppointmentActionsMenu, type AppointmentMenuAction } from "./appointment-actions-menu";
import { AppointmentStatusMenu } from "./appointment-status-menu";

type AppointmentCardProps = {
  appointment: Appointment;
  compact?: boolean;
  onEdit: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment, cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled") => void;
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

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const timeRange = `${start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${end.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Bloqueo Clinico";
  const patientId = appointment.patient?.id || "N/A";
  const patientFirstName = patientName.split(" ")[0] || patientName;
  const patientLastName = appointment.patient?.lastName.split(" ")[0] ?? "";
  const palette = appointmentColorPalette[appointment.status] || appointmentColorPalette.SCHEDULED;
  const hasAppointmentComment = Boolean(
    appointment.notes?.trim() ||
      appointment.appointmentNotes?.length ||
      (appointment._count?.appointmentNotes ?? 0) > 0
  );
  const commentButtonLabel = hasAppointmentComment ? "Editar comentario de cita" : "Agregar comentario de cita";

  const handleCommentClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onMenuAction) {
      onMenuAction(appointment, "addComment");
    } else {
      onEdit(appointment);
    }
  };

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
    const tooltipContent = (
      <div className="flex flex-col gap-0.5">
        <div className="text-[12px] font-semibold text-slate-900">
          {appointment.title.toUpperCase()}{" "}
          <span className="font-normal text-slate-500">
            ({appointment.chair?.name || "BOX 1"})
          </span>
        </div>
        <div className="mb-2 border-b border-slate-100 pb-1 text-[11px] text-slate-500">
          {appointmentStatusLabel(appointment.status)}
        </div>
        <div className="text-[11px] text-slate-700">
          ({patientId.slice(0, 5)}) {patientName.toUpperCase()}
        </div>
      </div>
    );

    return (
      <HelpTooltip
        disabled={menuOpen}
        position="auto"
        triggerClassName="h-full w-full flex"
        content={tooltipContent}
      >
        <div
          className={cn(
            "relative group flex h-full w-full cursor-pointer flex-col justify-between rounded-[var(--radius-sm)] border py-1 pr-1 pl-2.5 transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:shadow-[var(--shadow-card-hover)]",
            menuOpen ? "z-[80] overflow-visible menu-open" : "z-0 overflow-hidden",
            palette.cardClass
          )}
          onClick={(e) => {
            e.stopPropagation();
            const trigger = e.currentTarget.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
            if (trigger) {
              setTimeout(() => trigger.click(), 0);
            }
          }}
        >
          {/* Color bar indicator on left side */}
          <div className={cn("absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-[var(--radius-sm)]", palette.dotClass)} />

          {durationMin <= 20 ? (
            <div className="flex h-full w-full items-center justify-between gap-1 overflow-hidden">
              <div className="flex items-center min-w-0 gap-1 select-none">
                <span className="shrink-0 text-[8.5px] font-semibold opacity-75">
                  {start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span className="shrink-0 text-[8px] opacity-40">|</span>
                <span className="truncate text-[9.5px] font-bold">
                  {patientFirstName} {patientLastName}
                </span>
              </div>
              
              <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={(event) => event.stopPropagation()}>
                <AppointmentActionsMenu
                  appointment={appointment}
                  triggerVariant="compact"
                  placement="auto"
                  onOpenChange={setMenuOpen}
                  onAction={handleMenuAction}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between h-full w-full relative">
              <div className="min-w-0 pr-5">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[10px] font-bold text-[var(--text-primary)] leading-tight">
                    {patientFirstName} {patientLastName}
                  </span>
                  {hasAppointmentComment && (
                    <MessageSquare className="h-2.5 w-2.5 text-[var(--text-brand)] shrink-0" />
                  )}
                </div>
                <span className="truncate text-[9px] font-medium text-[var(--text-secondary)] leading-none block mt-0.5">
                  {timeRange}
                </span>
              </div>

              {durationMin >= 45 && (
                <span className="truncate text-[8px] font-bold uppercase tracking-wider opacity-75 select-none mt-1">
                  {appointmentStatusLabel(appointment.status)}
                </span>
              )}

              {/* Compact action menu showing on hover */}
              <div 
                className="absolute right-0 top-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-inherit pr-0.5 rounded-[var(--radius-sm)]" 
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label={commentButtonLabel}
                  title={commentButtonLabel}
                  onClick={handleCommentClick}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--bg-surface)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
                    hasAppointmentComment ? "text-[var(--text-brand)]" : "text-[var(--text-secondary)] hover:text-[var(--text-brand)]"
                  )}
                >
                  <MessageSquare className="h-3 w-3" />
                </button>
                <AppointmentActionsMenu
                  appointment={appointment}
                  triggerVariant="compact"
                  placement="auto"
                  onOpenChange={setMenuOpen}
                  onAction={handleMenuAction}
                />
              </div>
            </div>
          )}
        </div>
      </HelpTooltip>
    );
  }

  return (
    <article
      className={cn(
        "relative flex h-full flex-col justify-between rounded-[var(--radius-lg)] border p-[var(--space-4)] text-[var(--text-xs)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]",
        menuOpen ? "z-[80] overflow-visible menu-open" : "z-0",
        palette.cardClass
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="whitespace-nowrap text-[9px] font-medium text-[var(--text-secondary)]">
            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="flex min-w-0 items-center gap-1.5">
            <h4 className="truncate font-semibold leading-tight text-[var(--text-primary)]">{appointment.title}</h4>
            <button
              type="button"
              aria-label={commentButtonLabel}
              title={commentButtonLabel}
              onClick={handleCommentClick}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
                hasAppointmentComment ? "text-[var(--text-brand)]" : "text-[var(--text-secondary)] hover:text-[var(--text-brand)]"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          </div>
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
