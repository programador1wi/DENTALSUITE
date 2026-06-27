import { Modal } from "@/components/ui/modal";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";
import { EmptyState } from "@/components/feedback/empty-state";

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  PENDING_CONFIRMATION: "No confirmado",
  ARRIVED: "Llego",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Atendido",
  CANCELLED_BY_PATIENT: "Cancelada por paciente",
  CANCELLED_BY_CLINIC: "Cancelada por clinica",
  NO_SHOW: "No asiste",
  RESCHEDULED: "Cambio de fecha",
  BLOCKED: "Bloqueada"
};

export function AppointmentStatusHistoryModal({
  appointment,
  open,
  onClose
}: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}) {
  const history = appointment?.statusHistory ?? [];

  return (
    <Modal open={open} title="Historial de Cambios" onClose={onClose} size="lg">
      {!history.length ? (
        <EmptyState title="Sin historial" description="Esta cita no tiene registro de cambios de estado." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
                <th className="px-3 py-3">Usuario</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 text-slate-700">
                    {record.changedBy ? `${record.changedBy.firstName} ${record.changedBy.lastName}` : "Sistema"}
                  </td>
                  <td className="px-3 py-3 text-slate-900">
                    {appointmentStatusLabels[record.newStatus] ?? record.newStatus}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {new Date(record.createdAt).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
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
