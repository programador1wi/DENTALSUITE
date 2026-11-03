import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ExternalLink, MessageCircle, Plus, Printer, Search, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useAppointments } from "@/features/agenda/hooks/use-appointments";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";
import { AppointmentStatusHistoryModal } from "../../agenda/components/appointment-status-history-modal";
import { AppointmentCommentsModal } from "../../agenda/components/appointment-comments-modal";
import { PatientAppointmentsStats } from "./patient-appointments-stats";

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

const inactiveAppointmentStatuses = new Set<AppointmentStatus>([
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "NO_SHOW",
  "RESCHEDULED"
]);

function appointmentStatusTone(row: Appointment) {
  if (row.status === "COMPLETED") return "success" as const;
  if (inactiveAppointmentStatuses.has(row.status)) return "danger" as const;
  return "warning" as const;
}

function numericId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000000).toString().padStart(6, "0");
}

export function PatientAppointmentsTab({ patientId }: { patientId: string }) {
  const appointments = useAppointments({ patientId }, true);
  const [search, setSearch] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [historyAppointment, setHistoryAppointment] = useState<Appointment | null>(null);
  const [commentsAppointmentId, setCommentsAppointmentId] = useState<string | null>(null);

  const rows = appointments.data ?? [];

  const professionals = useMemo(() => {
    const map = new Map<string, Appointment["professional"]>();
    rows.forEach((appointment) => map.set(appointment.professional.id, appointment.professional));
    return [...map.values()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...rows].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    );
    return sorted.filter((appointment) => {
      if (professionalId && appointment.professional.id !== professionalId) return false;
      if (!term) return true;
      return [
        appointment.id,
        appointment.title,
        appointment.reason ?? "",
        appointment.treatmentPlan?.name ?? "",
        appointment.branch?.name ?? "",
        `${appointment.professional.firstName} ${appointment.professional.lastName}`
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [professionalId, rows, search]);

  if (appointments.isLoading) return <LoadingState message="Cargando citas del paciente..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Citas</h2>
          {rows.length > 0 ? (
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--action-primary)] px-2 text-xs font-bold text-white">
              {rows.length}
            </span>
          ) : null}
        </div>

        {/* Filters bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por numero o nombre de tratamiento"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-1.5 text-xs font-semibold"
              onClick={() => setIsStatsModalOpen(true)}
              aria-label="Ver estadísticas de citas"
            >
              <BarChart3 className="h-4 w-4 text-[var(--action-primary)]" />
              Estadísticas
            </Button>
            <Select
              className="w-64"
              value={professionalId}
              onChange={(event) => setProfessionalId(event.target.value)}
            >
              <option value="">Profesional o recurso</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.firstName} {professional.lastName}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              aria-label="Imprimir citas"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Link
              to={`/agenda/day?patientId=${encodeURIComponent(patientId)}`}
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--action-primary)] text-white shadow-md transition hover:bg-[var(--action-primary-hover)] hover:shadow-lg"
              aria-label="Nueva cita"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3"># Tratamiento</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Duracion</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Comentarios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((appointment) => {
              const startAt = new Date(appointment.startAt);
              const treatment = appointment.treatmentPlan;
              const tone = appointmentStatusTone(appointment);

              return (
                <tr
                  key={appointment.id}
                  className="align-top transition-colors hover:bg-slate-50/70"
                >
                  {/* # Tratamiento */}
                  <td className="px-4 py-3.5">
                    {treatment ? (
                      <>
                        <Link
                          to={`/patients/${patientId}/treatments?planId=${treatment.id}`}
                          className="group inline-flex items-center gap-1 font-medium text-[var(--action-primary)] hover:underline"
                        >
                          {numericId(treatment.id)}
                          <ExternalLink className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">{treatment.name}</p>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Sin tratamiento asignado</span>
                    )}
                  </td>

                  {/* Sucursal */}
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-800">
                      {appointment.branch?.name ?? "-"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {appointment.chair?.name ?? "Sillon 1"}
                    </p>
                  </td>

                  {/* Profesional */}
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-[var(--action-primary)]">
                      {appointment.professional.firstName} {appointment.professional.lastName}
                    </span>
                  </td>

                  {/* Fecha */}
                  <td className="px-4 py-3.5 text-slate-700">
                    {startAt.toLocaleDateString("es-MX", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </td>

                  {/* Hora */}
                  <td className="px-4 py-3.5 text-slate-700">
                    {startAt.toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>

                  {/* Duracion */}
                  <td className="px-4 py-3.5 text-slate-700">
                    {appointment.durationMinutes} min
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 transition hover:opacity-80"
                      onClick={() => setHistoryAppointment(appointment)}
                      title="Ver historial de estado"
                    >
                      <Badge
                        value={appointmentStatusLabels[appointment.status]}
                        tone={tone}
                      />
                      <Clock className={`h-3.5 w-3.5 ${
                        tone === "success"
                          ? "text-[var(--status-success-text)]"
                          : tone === "danger"
                            ? "text-[var(--status-danger-text)]"
                            : "text-[var(--status-warning-text)]"
                      }`} />
                    </button>
                  </td>

                  {/* Comentarios */}
                  <td className="px-4 py-3.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setCommentsAppointmentId(appointment.id)}
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      Ver
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!filteredRows.length ? (
        <div className="p-10">
          <EmptyState
            title="Sin citas"
            description="No hay citas que coincidan con el filtro."
          />
        </div>
      ) : null}

      <AppointmentStatusHistoryModal
        appointment={historyAppointment}
        open={Boolean(historyAppointment)}
        onClose={() => setHistoryAppointment(null)}
      />

      <AppointmentCommentsModal
        appointmentId={commentsAppointmentId}
        open={Boolean(commentsAppointmentId)}
        onClose={() => setCommentsAppointmentId(null)}
      />

      <Modal
        open={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        title="Estadísticas de Citas del Paciente"
        size="2xl"
      >
        <div className="pt-2">
          <PatientAppointmentsStats appointments={rows} />
        </div>
      </Modal>
    </section>
  );
}
