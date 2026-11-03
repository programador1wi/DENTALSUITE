import { useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Printer, X, Loader2 } from "lucide-react";
import { useAppointments } from "../hooks/use-appointments";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import type { AppointmentStatus } from "../services/appointments.service";
import { useDocumentTitle } from "@/hooks/use-document-title";

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

export function AgendaPrintPage() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const professionalIdParam = searchParams.get("professionalId") || "ALL";
  const branchIdParam = searchParams.get("branchId") || "";
  const { activeBranchId } = useBranchStore();
  const effectiveBranchId = branchIdParam || activeBranchId || "";

  useDocumentTitle(`Imprimir Agenda - ${date}`);

  const branches = useBranches(undefined, "ACTIVE");
  const branch = useMemo(() => {
    return branches.data?.find((b) => b.id === effectiveBranchId) ?? null;
  }, [branches.data, effectiveBranchId]);

  const professionals = useProfessionals(undefined, "true", {
    branchId: effectiveBranchId || undefined,
    pageSize: 100
  });

  const queryProfId = professionalIdParam === "ALL" ? undefined : professionalIdParam;

  const appointmentsQuery = useAppointments({
    date,
    view: "day",
    branchId: effectiveBranchId || undefined,
    professionalId: queryProfId
  });

  const sortedAppointments = useMemo(() => {
    const list = appointmentsQuery.data ?? [];
    return [...list].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [appointmentsQuery.data]);

  const targetProfessional = useMemo(() => {
    if (professionalIdParam === "ALL") return null;
    return (professionals.data ?? []).find((p) => p.id === professionalIdParam) ?? null;
  }, [professionals.data, professionalIdParam]);

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

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 p-4 md:p-8 font-sans text-zinc-800">
      {/* Top Action Bar (Screen Only - Minimalist Light Header) */}
      <div className="no-print mx-auto mb-6 flex w-full max-w-6xl items-center justify-between rounded-2xl bg-white/90 backdrop-blur-md border border-zinc-200/80 px-6 py-3 text-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 tracking-tight">Imprimir agenda diaria</h1>
            <p className="text-[11px] text-zinc-400">Vista previa oficial para documento en papel</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition shadow-sm"
            aria-label="Cerrar pestaña"
            title="Cerrar pestaña"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {appointmentsQuery.isLoading ? (
        <div className="no-print mx-auto flex h-64 w-full max-w-6xl items-center justify-center rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Cargando reporte de citas...</p>
          </div>
        </div>
      ) : (
        /* Printable Sheet Container */
        <div
          id="printable-agenda-sheet"
          className="mx-auto w-full max-w-6xl rounded-2xl border border-zinc-200/80 bg-white p-10 md:p-14 shadow-sm text-zinc-800 text-xs leading-normal"
        >
          {/* Printable CSS override */}
          <style>{`
              @media print {
                body {
                  background: white !important;
                  padding: 0 !important;
                }
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
            <h2 className="text-xl font-normal text-zinc-800 tracking-tight">
              Citas del Dr.(a) {targetProfessionalName}
            </h2>
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
                {sortedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 italic text-xs">
                      No hay citas programadas para esta fecha y profesional.
                    </td>
                  </tr>
                ) : (
                  sortedAppointments.map((appt) => {
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
                        <td className="py-3.5 px-2 text-center font-mono text-[10px] text-zinc-600">
                          {internalNo}
                        </td>
                        <td className="py-3.5 px-2 text-center text-zinc-600">
                          {appt.treatmentPlanId ? "1" : "1"}
                        </td>
                        <td className="py-3.5 px-2 text-center text-zinc-700">
                          {chairName.replace("Sillón ", "")}
                        </td>
                        <td className="py-3.5 px-2 text-center font-semibold text-zinc-900">
                          {startTime}
                        </td>
                        <td className="py-3.5 px-2 text-center text-zinc-600">
                          {endTime}
                        </td>
                        <td className="py-3.5 px-2 text-zinc-700">
                          <div>{statusText}</div>
                          {phone && <div className="text-[10px] text-zinc-500">{phone}</div>}
                        </td>
                        <td className="py-3.5 px-2 font-bold text-zinc-900 tracking-tight">
                          {patientName}
                        </td>
                        <td className="py-3.5 px-2 text-zinc-600 uppercase text-[10px]">
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
      )}
    </div>
  );
}
