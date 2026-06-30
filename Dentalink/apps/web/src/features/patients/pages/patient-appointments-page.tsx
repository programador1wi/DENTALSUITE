import { Link, useParams } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useAppointments } from "@/features/agenda/hooks/use-appointments";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";
import { PatientSectionPage } from "../components/patient-section-page";

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  CONFIRMED_BY_WHATSAPP: "Confirmada por WhatsApp",
  CONFIRMED_BY_PHONE: "Confirmada por teléfono",
  CONFIRMED_BY_EMAIL: "Confirmada por email",
  PENDING_CONFIRMATION: "Por confirmar",
  NOTIFIED_BY_WHATSAPP: "Notificada por WhatsApp",
  NOTIFIED_BY_EMAIL: "Notificada por email",
  ARRIVED: "Llego",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Atendida",
  CANCELLED_BY_PATIENT: "Cancelada por paciente",
  CANCELLED_BY_CLINIC: "Cancelada por clinica",
  CANCELLED_CONFLICT: "Cancelada conflicto",
  CANCELLED_RESCHEDULED: "Anulada reprogramación",
  NO_SHOW: "No asistio",
  RESCHEDULED: "Reagendada",
  BLOCKED: "Bloqueada"
};

const inactiveStatuses = new Set<AppointmentStatus>([
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED",
  "NO_SHOW",
  "RESCHEDULED"
]);

export function PatientAppointmentsPage() {
  const { id = "" } = useParams();
  const appointments = useAppointments({ patientId: id });
  const rows = appointments.data ?? [];
  const now = Date.now();
  const futureRows = rows.filter((appointment) => new Date(appointment.startAt).getTime() >= now && !inactiveStatuses.has(appointment.status));
  const completedRows = rows.filter((appointment) => appointment.status === "COMPLETED");

  if (appointments.isLoading) return <LoadingState message="Cargando citas del paciente..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Citas" description="Vista de citas del paciente.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Citas vinculadas al paciente</h2>
          <p className="text-sm text-slate-500">Todas las citas se leen desde el expediente de este paciente.</p>
        </div>
        <Link
          to={`/agenda/day?patientId=${encodeURIComponent(id)}`}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--action-primary)] bg-[var(--action-primary)] px-[var(--space-4)] text-[var(--text-base)] font-medium text-[var(--text-inverse)] transition hover:border-[var(--action-primary-hover)] hover:bg-[var(--action-primary-hover)]"
        >
          <CalendarPlus className="h-4 w-4" />
          Nueva cita
        </Link>
      </div>

      <Card className="grid gap-3 md:grid-cols-3">
        <Summary label="Total citas" value={rows.length} />
        <Summary label="Proximas activas" value={futureRows.length} />
        <Summary label="Atendidas" value={completedRows.length} />
      </Card>

      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin citas" description="Este paciente no tiene citas registradas." />}
        columns={[
          { key: "startAt", title: "Fecha", render: (row) => new Date(row.startAt).toLocaleString("es-MX") },
          { key: "title", title: "Titulo", render: (row) => row.title },
          { key: "professional", title: "Profesional", render: (row) => `${row.professional.firstName} ${row.professional.lastName}` },
          { key: "branch", title: "Sucursal", render: (row) => row.branch?.name ?? "-" },
          { key: "reason", title: "Motivo", render: (row) => row.reason ?? "-" },
          {
            key: "status",
            title: "Estado",
            render: (row) => <Badge value={statusLabels[row.status]} tone={statusTone(row)} />
          }
        ]}
      />
    </PatientSectionPage>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}

function statusTone(row: Appointment) {
  if (row.status === "COMPLETED") return "success";
  if (inactiveStatuses.has(row.status)) return "danger";
  return "warning";
}
