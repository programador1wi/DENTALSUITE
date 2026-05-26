import { useMemo, useState } from "react";
import { Clock, Printer } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Select } from "@/components/ui/select";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalAppointmentHistory } from "../hooks/use-clinical";
import type { ClinicalAppointmentHistoryItem, ClinicalAppointmentStatus } from "../services/clinical.service";

const cancelledStatuses = new Set<ClinicalAppointmentStatus>(["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC"]);

const statusOptions: Array<{ value: ClinicalAppointmentStatus; label: string }> = [
  { value: "SCHEDULED", label: "Agendada" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "PENDING_CONFIRMATION", label: "Por confirmar" },
  { value: "ARRIVED", label: "Llego" },
  { value: "WAITING_ROOM", label: "Sala de espera" },
  { value: "IN_PROGRESS", label: "En atencion" },
  { value: "COMPLETED", label: "Atendida" },
  { value: "CANCELLED_BY_PATIENT", label: "Cancelado por paciente" },
  { value: "CANCELLED_BY_CLINIC", label: "Cancelado por clinica" },
  { value: "NO_SHOW", label: "No asistio" },
  { value: "RESCHEDULED", label: "Reagendada" },
  { value: "BLOCKED", label: "Bloqueada" }
];

export function ClinicalHistoryPage() {
  const { id = "" } = useParams();
  const appointmentHistory = useClinicalAppointmentHistory(id);
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [showCancelled, setShowCancelled] = useState(true);

  const appointments = appointmentHistory.data ?? [];
  const monthOptions = useMemo(() => {
    const months = new Map<string, string>();
    for (const appointment of appointments) {
      const date = new Date(appointment.startAt);
      months.set(monthKey(date), monthLabel(date));
    }
    return Array.from(months, ([value, label]) => ({ value, label })).sort((left, right) => right.value.localeCompare(left.value));
  }, [appointments]);

  const groups = useMemo(() => {
    const filtered = appointments.filter((appointment) => {
      const matchesMonth = !month || monthKey(new Date(appointment.startAt)) === month;
      const matchesStatus = !status || appointment.status === status;
      const matchesCancelled = showCancelled || !cancelledStatuses.has(appointment.status);
      return matchesMonth && matchesStatus && matchesCancelled;
    });

    const byDate = new Map<string, ClinicalAppointmentHistoryItem[]>();
    for (const appointment of filtered) {
      const key = dayKey(new Date(appointment.startAt));
      byDate.set(key, [...(byDate.get(key) ?? []), appointment]);
    }

    return Array.from(byDate, ([date, items]) => ({
      date,
      label: timelineDateLabel(new Date(items[0].startAt)),
      items
    })).sort((left, right) => right.date.localeCompare(left.date));
  }, [appointments, month, showCancelled, status]);

  return (
    <ClinicalShell patientId={id} title="Historial" description="Citas agendadas y su estado.">
      <section className="bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4">
          <h2 className="mr-4 text-2xl font-light text-slate-900">Historial</h2>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            Filtrar por mes:
            <Select className="h-10 w-44 rounded border-slate-300 text-sm font-normal" value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="">Todos los meses</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            Filtrar por:
            <Select className="h-10 w-64 rounded border-slate-300 text-sm font-normal" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          <Button type="button" variant="secondary" size="sm" className="ml-auto h-10 w-11 px-0" onClick={() => window.print()} title="Imprimir historial">
            <Printer className="h-4 w-4" />
          </Button>
          <label className="inline-flex h-10 items-center gap-2 rounded bg-slate-100 px-3 text-sm text-slate-800">
            <input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} />
            Mostrar anuladas
          </label>
        </div>

        {appointmentHistory.isLoading ? <LoadingState message="Cargando historial de citas..." /> : null}
        {appointmentHistory.isError ? <ErrorState message={appointmentHistory.error.message} /> : null}

        {!appointmentHistory.isLoading && !appointmentHistory.isError ? (
          <div className="px-4 py-5">
            {groups.length > 0 ? <AppointmentTimeline groups={groups} /> : <EmptyTimeline />}
          </div>
        ) : null}
      </section>
    </ClinicalShell>
  );
}

function AppointmentTimeline({ groups }: { groups: Array<{ date: string; label: string; items: ClinicalAppointmentHistoryItem[] }> }) {
  return (
    <div className="relative grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="absolute left-[300px] top-0 hidden h-full w-1 bg-[#3d8a88] lg:block" />
      {groups.map((group) => (
        <div key={group.date} className="contents">
          <div className="relative flex items-center justify-end pr-12 text-sm font-semibold text-[#287f7c]">
            <span>{group.label}</span>
            <span className="absolute right-[-11px] hidden h-5 w-5 rounded-full bg-[#3d8a88] ring-8 ring-white lg:block" />
          </div>
          <div className="relative ml-0 max-w-[780px] rounded border border-slate-200 bg-white shadow-sm before:absolute before:-left-2 before:top-16 before:hidden before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-slate-200 before:bg-white lg:before:block">
            <div className="flex items-center justify-between border-r-4 border-red-500 px-3 py-3 text-xs font-bold uppercase text-red-500">
              <span>Cita agendada</span>
              <Clock className="h-4 w-4" />
            </div>
            <div className="divide-y divide-slate-200 bg-slate-50">
              {group.items.map((appointment) => (
                <div key={appointment.id} className="px-3 py-3">
                  <p className="text-sm text-slate-900">{statusLabel(appointment.status)}</p>
                  <p className="text-sm text-[#287f7c]">
                    {professionalName(appointment)}
                    {appointment.patient?.documentNumber ? ` , CURP/RFC: ${appointment.patient.documentNumber}` : ""}
                    {`, ${appointmentTime(appointment.startAt)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="grid min-h-56 lg:grid-cols-[300px_1fr]">
      <div className="relative hidden lg:block">
        <div className="absolute right-0 top-0 h-full w-1 bg-[#3d8a88]" />
        <span className="absolute right-[-8px] top-20 h-5 w-5 rounded-full bg-[#3d8a88] ring-8 ring-white" />
      </div>
      <div className="relative ml-0 max-w-[780px] rounded border border-slate-200 bg-white shadow-sm before:absolute before:-left-2 before:top-20 before:hidden before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-slate-200 before:bg-white lg:ml-12 lg:before:block">
        <div className="flex items-center justify-between border-r-4 border-red-500 px-3 py-3 text-xs font-bold uppercase text-red-500">
          <span>Cita agendada</span>
          <Clock className="h-4 w-4" />
        </div>
        <div className="bg-slate-50 px-3 py-6 text-sm text-slate-600">Sin citas agendadas para los filtros seleccionados.</div>
      </div>
    </div>
  );
}

function statusLabel(status: ClinicalAppointmentStatus) {
  if (cancelledStatuses.has(status)) return "Cancelado";
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function professionalName(appointment: ClinicalAppointmentHistoryItem) {
  return `Dr(a) ${appointment.professional.firstName} ${appointment.professional.lastName}`;
}

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(date);
}

function timelineDateLabel(date: Date) {
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date).replace(/\.$/, "");
  return `${month}. ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}
