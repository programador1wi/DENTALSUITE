import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarPlus, CreditCard, Download, HeartPulse, Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPatientStatusLabel, getPatientStatusTone } from "./patient-status";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { usePatient } from "../hooks/use-patients";

function calculateAge(birthDateString?: string | null) {
  if (!birthDateString) return null;
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0
  }).format(amount);
}

function compactDate(value?: string | null) {
  if (!value) return "Sin agendar";
  return new Date(value).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function InfoTile({
  title,
  value,
  icon,
  tone = "blue"
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone?: "blue" | "red" | "amber" | "green";
}) {
  const toneClass = {
    blue: "bg-white/14 text-white",
    red: "bg-red-500/28 text-white",
    amber: "bg-amber-400/25 text-white",
    green: "bg-emerald-400/25 text-white"
  }[tone];

  return (
    <div className={`min-w-[150px] rounded-md px-3 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
        {icon}
        {title}
      </div>
      <p className="mt-2 truncate text-xs font-medium">{value}</p>
    </div>
  );
}

export function PatientHeader({ patientId }: { patientId: string }) {
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading || isError || !patient) return null;

  const age = calculateAge(patient.birthDate);
  const balance = patient.summary?.balance ?? 0;
  const isDebtor = balance < 0;
  const activeAlerts = patient.medicalAlerts?.filter((alert) => alert.isActive) ?? [];
  const criticalAlerts = activeAlerts.filter((alert) => ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase()));
  const alertSummary = criticalAlerts.length
    ? `${criticalAlerts.length} alerta${criticalAlerts.length > 1 ? "s" : ""} critica${criticalAlerts.length > 1 ? "s" : ""}`
    : activeAlerts.length
      ? `${activeAlerts.length} alerta${activeAlerts.length > 1 ? "s" : ""}`
      : "Sin informacion";

  return (
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="bg-[#0879d5] px-4 py-4 text-white md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/90 text-3xl font-light text-[#0879d5]">
              {patient.firstName.charAt(0)}
              {patient.lastName.charAt(0)}
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span>ID {patient.id.replace(/\D/g, "").slice(-6) || patient.id.slice(0, 6)}</span>
                {patient.documentNumber ? <span>{patient.documentType || "DOC"} {patient.documentNumber}</span> : null}
                <Badge value={getPatientStatusLabel(patient.status)} tone={getPatientStatusTone(patient.status)} />
              </div>
              <h1 className="truncate text-xl font-bold uppercase tracking-tight md:text-2xl">
                {patient.firstName} {patient.lastName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/92">
                {patient.documentNumber ? <span>{patient.documentType || "Doc"}: {patient.documentNumber}</span> : null}
                {patient.gender ? <span>{patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Femenino" : patient.gender}</span> : null}
                {age !== null ? <span>{age} anos</span> : null}
                {patient.branch ? <span>Suc. {patient.branch.name}</span> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
            <InfoTile
              title="Alertas medicas"
              value={alertSummary}
              tone={criticalAlerts.length ? "red" : activeAlerts.length ? "amber" : "blue"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <InfoTile
              title="Estado financiero"
              value={`${formatCurrency(balance)} - ${isDebtor ? "Pago pendiente" : balance > 0 ? "Saldo a favor" : "Al dia"}`}
              tone={isDebtor ? "red" : balance > 0 ? "green" : "blue"}
              icon={<CreditCard className="h-4 w-4" />}
            />
            <InfoTile
              title="Proxima cita"
              value={compactDate(patient.summary?.nextAppointment)}
              icon={<CalendarPlus className="h-4 w-4" />}
            />
          </div>
        </div>

        {activeAlerts.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/18 pt-3 text-xs">
            <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide">
              <HeartPulse className="h-4 w-4" />
              Advertencias clinicas
              <HelpTooltip content="Condiciones de salud, alergias o restricciones activas que el equipo debe revisar antes de atender, recetar o realizar procedimientos." />
            </span>
            {activeAlerts.map((alert) => (
              <span key={alert.id} className="rounded bg-white/14 px-2 py-1 font-medium">
                {alert.type}: {alert.description}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/18 pt-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-white/14 px-2 py-1 font-medium">
              <HeartPulse className="h-4 w-4" />
              Enfermedades: Sin informacion
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-white/14 px-2 py-1 font-medium">
              <Pill className="h-4 w-4" />
              Medicamentos: Sin informacion
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
        <Link to="/agenda/day" className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-slate-50 hover:text-[#0879d5]">
          <CalendarPlus className="h-4 w-4" />
          Agendar
        </Link>
        <Link to={`/patients/${patientId}/payments`} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-slate-50 hover:text-[#0879d5]">
          <CreditCard className="h-4 w-4" />
          Recibir pago
        </Link>
        <Link to={`/patients/${patientId}/clinical/history`} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-slate-50 hover:text-[#0879d5]">
          <Download className="h-4 w-4" />
          Historia clinica
        </Link>
      </div>
    </section>
  );
}
