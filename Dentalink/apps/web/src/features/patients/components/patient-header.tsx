import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarPlus,
  CreditCard,
  Download,
  HeartPulse,
  Pill,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPatientStatusLabel, getPatientStatusTone } from "./patient-status";
import { usePatient } from "../hooks/use-patients";
import { formatPatientNumber, getPatientRouteId } from "@/lib/utils/patient-id";
import { APP_ROUTES } from "@/lib/routes";

function calculateAgeWithMonths(birthDateString?: string | null) {
  if (!birthDateString) return null;
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return null;
  return `${years} años${months > 0 ? `, ${months}M` : ""}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0
  }).format(amount);
}

function HeaderInfoTile({
  title,
  value,
  icon,
  tone = "neutral"
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success";
}) {
  const toneClasses = {
    neutral: "bg-white/10 text-white border-white/20 hover:bg-white/15",
    danger: "bg-red-500/25 text-red-100 border-red-300/40",
    warning: "bg-amber-500/25 text-amber-100 border-amber-300/40",
    success: "bg-emerald-500/25 text-emerald-100 border-emerald-300/40"
  }[tone];

  return (
    <div className={`min-w-[135px] flex-1 rounded-lg border px-3.5 py-2.5 text-white transition-colors ${toneClasses}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-100/90">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-1 truncate text-[13px] font-medium leading-snug">{value}</p>
    </div>
  );
}

export function PatientHeader({ patientId }: { patientId: string }) {
  const { data: patient, isLoading, isError } = usePatient(patientId);
  const [isSticky, setIsSticky] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!patient?.patientNumber) return;
    const canonicalRouteId = formatPatientNumber(patient.patientNumber);
    if (!canonicalRouteId) return;

    if (patientId === patient.id && patientId !== canonicalRouteId) {
      const currentPath = location.pathname;
      const newPath = currentPath
        .replace(`/pacientes/${patient.id}`, `/pacientes/${canonicalRouteId}`)
        .replace(`/patients/${patient.id}`, `/pacientes/${canonicalRouteId}`);
      if (newPath !== currentPath) {
        navigate(`${newPath}${location.search}${location.hash}`, { replace: true });
      }
    }
  }, [patient, patientId, location, navigate]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
      return;
    }

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        const passedThreshold = entry.boundingClientRect.bottom <= 56;
        setIsSticky(!entry.isIntersecting && passedThreshold);
      },
      {
        rootMargin: "-56px 0px 0px 0px",
        threshold: [0, 1]
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [patient]);

  if (isLoading || isError || !patient) return null;

  const ageText = calculateAgeWithMonths(patient.birthDate);
  const balance = patient.summary?.balance ?? 0;
  const isDebtor = balance > 0;
  const activeAlerts = patient.medicalAlerts?.filter((alert) => alert.isActive) ?? [];
  const criticalAlerts = activeAlerts.filter((alert) => ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase()));

  const alertsCountText = criticalAlerts.length
    ? `${criticalAlerts.length} crítica${criticalAlerts.length > 1 ? "s" : ""}`
    : activeAlerts.length
      ? `${activeAlerts.length} activa${activeAlerts.length > 1 ? "s" : ""}`
      : "Sin información";

  const displayId = formatPatientNumber(patient.patientNumber, patient.id);
  const canonicalId = getPatientRouteId(patient) || patientId;
  const initials = `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase();
  const genderLabel = patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Femenino" : patient.gender || "--";

  return (
    <>
      {/* Main Spacious Clinical Header */}
      <section
        ref={headerRef}
        className="overflow-hidden rounded-xl border border-[#0284c7]/40 bg-[#0879d5] text-white shadow-sm"
        aria-label="Ficha resumida del paciente"
      >
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Patient Identity */}
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#0879d5] shadow-sm ring-4 ring-white/20">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] font-medium text-sky-100">
                  <span className="font-semibold tracking-wide text-sky-200">ID {displayId}</span>
                  {patient.documentNumber ? (
                    <span>• {patient.documentType || "CURP"}: {patient.documentNumber}</span>
                  ) : null}
                  <Badge
                    value={getPatientStatusLabel(patient.status)}
                    tone={getPatientStatusTone(patient.status)}
                    className="bg-white/20 text-white border-white/30 text-[11px] h-5 px-2"
                  />
                  {patient.agreement?.name && (
                    <span className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-100" />
                      Convenio {patient.agreement.name}
                    </span>
                  )}
                </div>

                <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-[26px]">
                  {patient.firstName} {patient.lastName}
                </h1>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-sky-100">
                  <span>{patient.documentType || "CURP"}: {patient.documentNumber || "--"}</span>
                  <span>• {genderLabel}</span>
                  {ageText && <span>• {ageText}</span>}
                </div>
              </div>
            </div>

            {/* Status & Medical Alerts Summary Cards */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:w-[480px]">
              <HeaderInfoTile
                title="Alertas médicas"
                value={alertsCountText}
                tone={criticalAlerts.length ? "danger" : activeAlerts.length ? "warning" : "neutral"}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <HeaderInfoTile
                title="Enfermedades"
                value={activeAlerts.some((a) => a.type?.toLowerCase().includes("enfermedad")) ? "Registradas" : "Sin información"}
                icon={<HeartPulse className="h-4 w-4" />}
              />
              <HeaderInfoTile
                title="Medicamentos"
                value={activeAlerts.some((a) => a.type?.toLowerCase().includes("medicamento")) ? "Registrados" : "Sin información"}
                icon={<Pill className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Active clinical warning details */}
          {activeAlerts.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-white/20 pt-3 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                Advertencias Clínicas:
              </span>
              {activeAlerts.map((alert) => (
                <span
                  key={alert.id}
                  className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-white border border-white/20"
                >
                  <span className="font-semibold text-amber-200">{alert.type}:</span> {alert.description}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Action Navigation Bar */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/15 bg-[#0668ba]/40 px-5 py-2.5 text-[13px] font-medium text-sky-100">
          <Link
            to={`/agenda/day?patientId=${encodeURIComponent(canonicalId)}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3.5 py-1.5 text-white transition-colors hover:bg-white/20"
          >
            <CalendarPlus className="h-4 w-4 text-sky-200" />
            Agendar
          </Link>
          <Link
            to={APP_ROUTES.patients.payments(canonicalId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3.5 py-1.5 text-white transition-colors hover:bg-white/20"
          >
            <CreditCard className="h-4 w-4 text-sky-200" />
            Recibir pago
          </Link>
          <Link
            to={APP_ROUTES.patients.clinicalHistory(canonicalId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3.5 py-1.5 text-white transition-colors hover:bg-white/20"
          >
            <Download className="h-4 w-4 text-sky-200" />
            Historia clínica
          </Link>
        </div>
      </section>

      {/* Sentinel element to detect when main header leaves the top */}
      <div ref={sentinelRef} className="h-0 w-full pointer-events-none" aria-hidden="true" />

      {/* Sticky Header with commanding, legible proportions on scroll */}
      {typeof document !== "undefined" &&
        createPortal(
          <aside
            role="region"
            aria-label="Identificador persistente de paciente"
            className={`fixed top-14 left-0 right-0 z-40 pointer-events-none transition-all duration-200 ease-out ${
              isSticky ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="mx-auto w-full max-w-[1536px] px-3 sm:px-5 lg:px-6">
              <div className="pointer-events-auto flex items-center justify-between gap-4 rounded-b-xl border-x border-b border-[#0284c7]/40 bg-[#0879d5] px-5 py-3 text-white shadow-xl">
                {/* Generous patient identity block */}
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-[#0879d5] shadow-sm ring-2 ring-white/30">
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold leading-tight text-white sm:text-xl">
                        {patient.firstName} {patient.lastName}
                      </h2>
                      <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-semibold text-sky-100">
                        ID {displayId}
                      </span>
                      {patient.agreement?.name && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                          <ShieldCheck className="h-3 w-3 text-sky-100" />
                          {patient.agreement.name}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-medium text-sky-100">
                      <span>{patient.documentType || "CURP"}: {patient.documentNumber || "--"}</span>
                      <span>•</span>
                      <span>{genderLabel}</span>
                      {ageText && (
                        <>
                          <span>•</span>
                          <span>{ageText}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side status badges & generous action buttons */}
                <div className="flex shrink-0 items-center gap-3">
                  {criticalAlerts.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="hidden sm:inline">{criticalAlerts.length} alerta(s)</span>
                    </span>
                  )}

                  {isDebtor && (
                    <span className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 shadow-sm">
                      Deuda: {formatCurrency(balance)}
                    </span>
                  )}

                  <div className="hidden sm:flex items-center gap-2 border-l border-white/20 pl-3">
                    <Link
                      to={`/agenda/day?patientId=${encodeURIComponent(canonicalId)}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      <CalendarPlus className="h-4 w-4 text-sky-200" />
                      Agendar
                    </Link>
                    <Link
                      to={APP_ROUTES.patients.payments(canonicalId)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      <CreditCard className="h-4 w-4 text-sky-200" />
                      Pagar
                    </Link>
                    <Link
                      to={APP_ROUTES.patients.clinicalHistory(canonicalId)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      <Download className="h-4 w-4 text-sky-200" />
                      Historia
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </aside>,
          document.body
        )}
    </>
  );
}
