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
    blue: "bg-[rgba(2,132,199,0.08)] text-[var(--text-brand)]",
    red: "bg-[rgba(239,68,68,0.08)] text-[var(--text-danger)]",
    amber: "bg-[rgba(251,191,36,0.14)] text-[var(--text-warning)]",
    green: "bg-[rgba(16,185,129,0.08)] text-[var(--text-success)]"
  }[tone];

  return (
    <div className={`min-w-[150px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase">
        {icon}
        {title}
      </div>
      <p className="mt-2 truncate text-[13px] font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function PatientHeader({ patientId }: { patientId: string }) {
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading || isError || !patient) return null;

  const age = calculateAge(patient.birthDate);
  const balance = patient.summary?.balance ?? 0;
  const isDebtor = balance > 0;
  const hasCredit = balance < 0;
  const activeAlerts = patient.medicalAlerts?.filter((alert) => alert.isActive) ?? [];
  const criticalAlerts = activeAlerts.filter((alert) => ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase()));
  const alertSummary = criticalAlerts.length
    ? `${criticalAlerts.length} alerta${criticalAlerts.length > 1 ? "s" : ""} critica${criticalAlerts.length > 1 ? "s" : ""}`
    : activeAlerts.length
      ? `${activeAlerts.length} alerta${activeAlerts.length > 1 ? "s" : ""}`
      : "Sin informacion";

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="px-[var(--space-4)] py-[var(--space-4)] md:px-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-subtle)] text-[24px] font-semibold text-[var(--text-brand)]">
              {patient.firstName.charAt(0)}
              {patient.lastName.charAt(0)}
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
                <span>ID {patient.id.replace(/\D/g, "").slice(-6) || patient.id.slice(0, 6)}</span>
                {patient.documentNumber ? <span>{patient.documentType || "DOC"} {patient.documentNumber}</span> : null}
                <Badge value={getPatientStatusLabel(patient.status)} tone={getPatientStatusTone(patient.status)} />
              </div>
              <h1 className="truncate text-[24px] font-semibold leading-tight text-[var(--text-primary)]">
                {patient.firstName} {patient.lastName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[var(--text-secondary)]">
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
              value={`${formatCurrency(Math.abs(balance))} - ${isDebtor ? "Pendiente" : hasCredit ? "Saldo a favor" : "Al dia"}`}
              tone={isDebtor ? "red" : hasCredit ? "green" : "blue"}
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
          <div className="mt-[var(--space-4)] flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-[var(--space-3)] text-[13px]">
            <span className="inline-flex items-center gap-1 font-semibold uppercase text-[var(--text-danger)]">
              <HeartPulse className="h-4 w-4" />
              Advertencias clinicas
              <HelpTooltip content="Condiciones de salud, alergias o restricciones activas que el equipo debe revisar antes de atender, recetar o realizar procedimientos." />
            </span>
            {activeAlerts.map((alert) => (
              <span key={alert.id} className="rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.08)] px-2 py-1 font-medium text-[var(--text-danger)]">
                {alert.type}: {alert.description}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-[var(--space-4)] flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-[var(--space-3)] text-[13px]">
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-1 font-medium text-[var(--text-secondary)]">
              <HeartPulse className="h-4 w-4" />
              Enfermedades: Sin informacion
            </span>
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-1 font-medium text-[var(--text-secondary)]">
              <Pill className="h-4 w-4" />
              Medicamentos: Sin informacion
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-2)] text-[13px] font-medium text-[var(--text-secondary)]">
        <Link to={`/agenda/day?patientId=${encodeURIComponent(patientId)}`} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 hover:bg-[var(--bg-surface)] hover:text-[var(--text-brand)]">
          <CalendarPlus className="h-4 w-4" />
          Agendar
        </Link>
        <Link to={`/patients/${patientId}/payments`} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 hover:bg-[var(--bg-surface)] hover:text-[var(--text-brand)]">
          <CreditCard className="h-4 w-4" />
          Recibir pago
        </Link>
        <Link to={`/patients/${patientId}/clinical/history`} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 hover:bg-[var(--bg-surface)] hover:text-[var(--text-brand)]">
          <Download className="h-4 w-4" />
          Historia clinica
        </Link>
      </div>
    </section>
  );
}
