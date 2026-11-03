import { useMemo } from "react";
import { Printer, X } from "lucide-react";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";

interface CalendarProfessional {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  CONFIRMED_BY_WHATSAPP: "Notificado por WhatsApp",
  CONFIRMED_BY_PHONE: "Confirmado por teléfono",
  CONFIRMED_BY_EMAIL: "Confirmado por email",
  PENDING_CONFIRMATION: "Por confirmar",
  NOTIFIED_BY_WHATSAPP: "Notificado por WhatsApp",
  NOTIFIED_BY_EMAIL: "Notificado por email",
  ARRIVED: "Llegó a clínica",
  WAITING_ROOM: "En sala de espera",
  IN_PROGRESS: "Atendiéndose",
  COMPLETED: "Atendido",
  RESCHEDULED: "Reagendada",
  NO_SHOW: "No asiste",
  CANCELLED_BY_PATIENT: "Cancelado por paciente",
  CANCELLED_BY_CLINIC: "Cancelado por clínica",
  CANCELLED_CONFLICT: "Cancelado en conflicto",
  CANCELLED_RESCHEDULED: "Anulado por reprogramación",
  BLOCKED: "Bloqueada"
};

export function AgendaPrintModal({
  open,
  onClose,
  targetProfessionalId,
  date,
  appointments,
  professionals,
  branch
}: {
  open: boolean;
  onClose: () => void;
  targetProfessionalId: string | "ALL" | null;
  date: string;
  appointments: Appointment[];
  professionals: CalendarProfessional[];
  branch: Branch | null;
}) {
  if (!open || !targetProfessionalId) return null;

  const filteredAppointments = useMemo(() => {
    const list = targetProfessionalId === "ALL"
      ? [...appointments]
      : appointments.filter((a) => a.professionalId === targetProfessionalId);

    return list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [appointments, targetProfessionalId]);

  const targetProfessional = useMemo(() => {
    if (targetProfessionalId === "ALL") return null;
    return professionals.find((p) => p.id === targetProfessionalId) ?? null;
  }, [professionals, targetProfessionalId]);

  const targetProfessionalName = targetProfessional
    ? `${targetProfessional.firstName} ${targetProfessional.lastName}`.trim()
    : "Todos los profesionales";

  const formattedDate = useMemo(() => {
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.toLocaleDateString("es-MX", { weekday: "long" });
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const monthName = dateObj.toLocaleDateString("es-MX", { month: "long" });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalizedDay}, ${day} de ${capitalizedMonth} de ${year}`;
  }, [date]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/70 backdrop-blur-sm overflow-y-auto p-4 md:p-8 animate-in fade-in duration-200">
      {/* Top action bar (screen only) */}
      <div className="no-print mx-auto mb-4 flex w-full max-w-6xl items-center justify-between rounded-xl bg-zinc-800 px-6 py-3.5 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Printer className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold">Imprimir agenda diaria</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] px-5 py-2 text-sm font-bold text-white shadow-md transition active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 p-2 text-zinc-300 hover:text-white transition"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Wrapper */}
      <div
        id="printable-agenda-sheet"
        className="mx-auto w-full max-w-6xl rounded-2xl bg-white p-10 md:p-14 shadow-2xl text-zinc-800 text-xs leading-normal font-sans"
      >
        {/* Printable CSS override */}
        <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-agenda-sheet, #printable-agenda-sheet * {
                visibility: visible !important;
              }
              #printable-agenda-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 16px !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

        {/* Header section with Dental+ Logo and Branch Info */}
        <div className="flex items-start justify-between pb-6 border-b border-zinc-200">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center text-red-600 font-extrabold text-2xl tracking-tighter">
              <span className="italic font-black text-red-600 text-3xl">Dental</span>
              <span className="text-red-500 text-2xl font-bold ml-0.5">+</span>
            </div>
          </div>

          {/* Branch Details */}
          <div className="text-right text-[11px] text-zinc-600 space-y-0.5">
            <p className="font-bold text-sm text-zinc-900 uppercase tracking-wide">
              {branch?.name || "DENTAL +"}
            </p>
            {branch?.address && <p>{branch.address}</p>}
            {branch?.phone && <p>{branch.phone}</p>}
          </div>
        </div>

        {/* Report Title Subheader */}
        <div className="my-8 text-center space-y-1">
          <h1 className="text-xl font-normal text-zinc-800 tracking-tight">
            Citas del Dr.(a) {targetProfessionalName}
          </h1>
          <p className="text-xs text-zinc-500">
            Fecha agenda: <span className="font-medium text-zinc-700">{formattedDate}</span>
          </p>
        </div>

        {/* Table of Appointments */}
        <div className="overflow-hidden border-t border-b border-zinc-200 my-6">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-2 text-center">Nº Interno</th>
                <th className="py-2.5 px-2 text-center">#Trat.</th>
                <th className="py-2.5 px-2 text-center">Cubículo</th>
                <th className="py-2.5 px-2 text-center">Hora</th>
                <th className="py-2.5 px-2 text-center">Fin</th>
                <th className="py-2.5 px-2">Estado</th>
                <th className="py-2.5 px-2">Paciente</th>
                <th className="py-2.5 px-2">Comentario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400 italic text-xs">
                    No hay citas programadas para esta fecha y profesional.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const startTime = new Date(appt.startAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                  });
                  const endTime = new Date(appt.endAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                  });
                  const patientName = appt.patient
                    ? `${appt.patient.firstName} ${appt.patient.lastName}`.toUpperCase()
                    : (appt.title || "SIN PACIENTE").toUpperCase();
                  const phone = appt.patient?.phone ? `(- ${appt.patient.phone})` : "";
                  const statusText = STATUS_LABELS[appt.status] || appt.status;
                  const chairName = appt.chair?.name?.replace(/sillón/i, "BOX") || "BOX 1";
                  const internalNo = (appt.patient?.id ? appt.patient.id.slice(-6) : appt.id.slice(-6)).toUpperCase();

                  return (
                    <tr key={appt.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-2 text-center font-mono text-[10px] text-zinc-600">
                        {internalNo}
                      </td>
                      <td className="py-3 px-2 text-center text-zinc-600">
                        {appt.treatmentPlanId ? "1" : "1"}
                      </td>
                      <td className="py-3 px-2 text-center text-zinc-700">
                        {chairName.replace("Sillón ", "")}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-zinc-900">
                        {startTime}
                      </td>
                      <td className="py-3 px-2 text-center text-zinc-600">
                        {endTime}
                      </td>
                      <td className="py-3 px-2 text-zinc-700">
                        <div>{statusText}</div>
                        {phone && <div className="text-[10px] text-zinc-500">{phone}</div>}
                      </td>
                      <td className="py-3 px-2 font-bold text-zinc-900 tracking-tight">
                        {patientName}
                      </td>
                      <td className="py-3 px-2 text-zinc-600 uppercase text-[10px]">
                        {appt.notes || appt.title || "CONSULTA GRAL."}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer */}
        <div className="mt-12 text-center text-[11px] text-zinc-500 space-y-1">
          <p className="font-bold text-zinc-800 text-sm">
            Dr.(a) {targetProfessionalName}
          </p>
          <p>{branch?.name || "Dental + Suc. Condesa"}</p>
          {branch?.address && <p>{branch.address}</p>}
          {branch?.phone && <p>{branch.phone}</p>}
        </div>
      </div>
    </div>
  );
}
