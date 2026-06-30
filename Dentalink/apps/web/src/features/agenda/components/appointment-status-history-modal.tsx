import { Modal } from "@/components/ui/modal";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useAppointment } from "../hooks/use-appointments";

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmado",
  CONFIRMED_BY_WHATSAPP: "Confirmado por WhatsApp",
  CONFIRMED_BY_PHONE: "Confirmado por teléfono",
  CONFIRMED_BY_EMAIL: "Confirmado por email",
  PENDING_CONFIRMATION: "No confirmado",
  NOTIFIED_BY_WHATSAPP: "Notificado por WhatsApp",
  NOTIFIED_BY_EMAIL: "Notificado por email",
  ARRIVED: "Llego",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Atendido",
  CANCELLED_BY_PATIENT: "Cancelada por paciente",
  CANCELLED_BY_CLINIC: "Cancelada por clinica",
  CANCELLED_CONFLICT: "Cancelado por conflicto",
  CANCELLED_RESCHEDULED: "Anulado por reprogramación",
  NO_SHOW: "No asiste",
  RESCHEDULED: "Cambio de fecha",
  BLOCKED: "Bloqueada"
};

import { translateReason } from "./appointment-status";

export function AppointmentStatusHistoryModal({
  appointment,
  open,
  onClose
}: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAppointment(appointment?.id ?? null, open);
  const detail = query.data ?? appointment;
  const history = detail?.statusHistory ?? [];

  return (
    <Modal open={open} title="Historial de Cambios" onClose={onClose} size="xl">
      {query.isLoading ? (
        <div className="py-12">
          <LoadingState message="Cargando historial..." />
        </div>
      ) : !history.length ? (
        <EmptyState title="Sin historial" description="Esta cita no tiene registro de cambios de estado." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
                <th className="px-3 py-3">Transición</th>
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 text-slate-900">
                    <span className="text-slate-500 font-medium text-xs">
                      {record.previousStatus ? appointmentStatusLabels[record.previousStatus] : "Nueva"}
                    </span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="font-semibold">
                      {appointmentStatusLabels[record.newStatus] ?? record.newStatus}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {record.changedBy ? `${record.changedBy.firstName} ${record.changedBy.lastName}` : "Sistema"}
                  </td>
                  <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                    {new Date(record.createdAt).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {record.reason ? (
                      <span className="italic text-xs block truncate" title={translateReason(record.reason)}>{translateReason(record.reason)}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
