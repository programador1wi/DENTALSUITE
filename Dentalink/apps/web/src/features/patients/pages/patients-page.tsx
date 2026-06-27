import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, ChevronRight, ClipboardList, IdCard, Mail, Phone, UserRound, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { LoadingState } from "@/components/feedback/loading-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { useDeactivatePatient, usePatients } from "../hooks/use-patients";
import type { PatientListItem } from "../services/patients.service";
import { PatientsModuleTabs } from "../components/patients-module-tabs";
import { PatientSearchBox } from "../components/patient-search-box";
import { getPatientStatusLabel, getPatientStatusTone } from "../components/patient-status";

type FilterState = {
  search: string;
  status: string;
  branchId: string;
  treatment: string;
};

const initialFilters: FilterState = {
  search: "",
  status: "",
  branchId: "",
  treatment: ""
};

function patientNumber(patient: PatientListItem, index: number) {
  const numeric = patient.id.replace(/\D/g, "").slice(-5);
  return numeric || String(6700 + index);
}

function treatmentCount(patient: PatientListItem) {
  return patient.status === "IN_TREATMENT" ? 3 : 1;
}

function patientInitials(patient: PatientListItem) {
  const first = patient.firstName?.trim().charAt(0) ?? "";
  const last = patient.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "P";
}

function PreviewFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#0784d8] shadow-sm ring-1 ring-slate-200">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400">{label}</p>
        <p className="truncate font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = {
    default: "text-slate-800",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700"
  }[tone];

  return (
    <div className="min-w-[110px]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function PreviewLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded border border-[#0784d8]/20 bg-white px-3 py-2 text-xs font-semibold text-[#0784d8] shadow-sm transition hover:border-[#0784d8]/40 hover:bg-[#eef8ff]"
      onClick={(event) => event.stopPropagation()}
    >
      {icon}
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function PatientPreview({ patient, number }: { patient: PatientListItem; number: string }) {
  const fullName = `${patient.firstName} ${patient.lastName}`.trim() || "Paciente sin nombre";
  const debtValue = patient.hasDebt ? "Pendiente" : "No tiene";

  return (
    <tr className="border-b-2 border-[#0784d8] bg-[#eef8ff]">
      <td colSpan={6} className="px-4 py-5">
        <div className="patient-preview-panel grid gap-5 lg:grid-cols-[190px_1fr_1.2fr]">
          <div className="flex items-center justify-center lg:justify-start">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#bfe6fb] to-[#e8f8f3] text-3xl font-bold text-[#0784d8] shadow-sm">
              {patientInitials(patient)}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-bold uppercase text-slate-900">{fullName}</h3>
                <Badge value={getPatientStatusLabel(patient.status)} tone={getPatientStatusTone(patient.status)} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Paciente #{number}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewFact icon={<IdCard className="h-4 w-4" />} label="Documento" value={patient.documentNumber || "Sin documento"} />
              <PreviewFact icon={<Mail className="h-4 w-4" />} label="Correo" value={patient.email || "Sin correo"} />
              <PreviewFact icon={<Phone className="h-4 w-4" />} label="Telefono" value={patient.phone || "Sin telefono"} />
              <PreviewFact icon={<UserRound className="h-4 w-4" />} label="Sucursal" value={patient.branchName || "Sin sucursal"} />
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#0784d8]/15 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PreviewStat label="Tratamientos" value={String(treatmentCount(patient))} tone={patient.status === "IN_TREATMENT" ? "success" : "default"} />
              <PreviewStat label="Deudas" value={debtValue} tone={patient.hasDebt ? "warning" : "success"} />
              <PreviewStat label="Cita futura" value={patient.hasFutureAppointment ? "Agendada" : "Sin cita"} tone={patient.hasFutureAppointment ? "success" : "default"} />
              <PreviewStat label="Alertas" value={patient.hasCriticalAlert ? "Critica" : "Sin alertas"} tone={patient.hasCriticalAlert ? "danger" : "success"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <PreviewLink to={`/patients/${patient.id}/profile`} icon={<UserRound className="h-4 w-4" />}>
                Ir a datos personales
              </PreviewLink>
              <PreviewLink to={`/patients/${patient.id}/treatments`} icon={<ClipboardList className="h-4 w-4" />}>
                Ir a tratamientos
              </PreviewLink>
              <PreviewLink to={`/patients/${patient.id}/payments`} icon={<WalletCards className="h-4 w-4" />}>
                Ir a recaudacion
              </PreviewLink>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {patient.hasFutureAppointment ? (
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Tiene una cita futura registrada</span>
              ) : null}
              {patient.hasCriticalAlert ? (
                <span className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> Revisar alertas clinicas</span>
              ) : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...initialFilters,
    search: searchParams.get("search") ?? "",
    branchId: searchParams.get("branchId") ?? ""
  }));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const branchQuery = useBranches(undefined, "ACTIVE");
  const isGlobalHeaderSearch = Boolean(filters.search.trim()) && !filters.branchId && !searchParams.has("branchId");
  const selectedBranchId = isGlobalHeaderSearch ? "" : filters.branchId || activeBranchId;
  const patientQuery = usePatients({
    search: filters.search || undefined,
    status: filters.status || undefined,
    branchId: selectedBranchId || undefined
  });
  const deactivatePatient = useDeactivatePatient();

  useEffect(() => {
    if (!expandedPatientId) return;
    if (!patientQuery.data?.some((patient) => patient.id === expandedPatientId)) {
      setExpandedPatientId(null);
    }
  }, [expandedPatientId, patientQuery.data]);

  useEffect(() => {
    const search = searchParams.get("search") ?? "";
    const branchId = searchParams.get("branchId") ?? "";
    setFilters((prev) =>
      prev.search === search && prev.branchId === branchId ? prev : { ...prev, search, branchId }
    );
    if (branchId) setActiveBranchId(branchId);
  }, [searchParams, setActiveBranchId]);

  useEffect(() => {
    if (!activeBranchId) return;
    if (searchParams.get("search")?.trim() && !searchParams.get("branchId")) return;
    if (filters.branchId !== activeBranchId) {
      setFilters((prev) => ({ ...prev, branchId: activeBranchId }));
    }

    if (searchParams.get("branchId") !== activeBranchId) {
      const next = new URLSearchParams(searchParams);
      next.set("branchId", activeBranchId);
      setSearchParams(next, { replace: true });
    }
  }, [activeBranchId, filters.branchId, searchParams, setSearchParams]);

  const selectedPatient = useMemo(
    () => patientQuery.data?.find((patient) => patient.id === confirmId) ?? null,
    [confirmId, patientQuery.data]
  );

  const onConfirmDeactivate = async () => {
    if (!confirmId) return;
    await deactivatePatient.mutateAsync(confirmId);
    setConfirmId(null);
  };

  const submitFilters = (searchOverride = filters.search) => {
    const next = new URLSearchParams(searchParams);
    if (searchOverride.trim()) next.set("search", searchOverride.trim());
    else next.delete("search");
    if (selectedBranchId) next.set("branchId", selectedBranchId);
    else next.delete("branchId");
    setSearchParams(next, { replace: true });
  };

  const actions = (
    <Link to="/patients/new">
      <button className="rounded bg-[#49ad50] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3d9944]">
        + Nuevo paciente
      </button>
    </Link>
  );

  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;

  return (
    <WarnerSuitePanel>
      <PatientsModuleTabs actions={actions} />

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="w-full max-w-[360px]">
            <PatientSearchBox
              placeholder="Buscar por nombre o apellido..."
              value={filters.search}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              onSubmit={(value) => submitFilters(value)}
              onSelect={(patient) => {
                navigate(`/patients/${patient.id}/profile`);
              }}
              inputClassName="rounded-lg border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-[var(--action-primary)] focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-[var(--action-primary)] focus:bg-white"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Habilitados</option>
              <option value="NEW">Nuevos</option>
              <option value="ACTIVE">Activos</option>
              <option value="IN_TREATMENT">En tratamiento</option>
              <option value="DEBTOR">Morosos</option>
            </select>
            <select
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-[var(--action-primary)] focus:bg-white"
              value={selectedBranchId}
              onChange={(event) => {
                const branchId = event.target.value;
                const next = new URLSearchParams(searchParams);
                if (branchId) next.set("branchId", branchId);
                else next.delete("branchId");
                setActiveBranchId(branchId);
                setFilters((prev) => ({ ...prev, branchId }));
                setSearchParams(next, { replace: true });
              }}
            >
              <option value="">Todas las sucursales</option>
              {branchQuery.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border-0 bg-[var(--bg-brand-light)] px-3 text-sm font-bold text-[var(--text-brand-strong)] outline-none hover:bg-[#d4e6f8]"
              value={filters.treatment}
              onChange={(event) => setFilters((prev) => ({ ...prev, treatment: event.target.value }))}
            >
              <option value="">Tratamiento</option>
              <option value="ortodoncia">Ortodoncia</option>
              <option value="general">General</option>
            </select>
            <button className="h-10 rounded-lg bg-[var(--action-primary)] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--action-primary-hover)]" type="button" onClick={() => submitFilters()}>
              Buscar
            </button>
          </div>
        </div>

        {patientQuery.isLoading ? (
          <LoadingState message="Cargando pacientes..." />
        ) : !patientQuery.data?.length ? (
          <EmptyState title="Sin pacientes" description="No hay pacientes para los filtros seleccionados." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-[100px] px-4 py-4">#</th>
                  <th className="px-4 py-4 text-slate-700">Nombre ^</th>
                  <th className="px-4 py-4">Apellidos</th>
                  <th className="px-4 py-4 text-center">Tratamientos</th>
                  <th className="px-4 py-4">Deudas</th>
                  <th className="w-[48px] px-4 py-4" />
                </tr>
              </thead>
              <tbody>
                {(patientQuery.data ?? []).map((patient, index) => {
                  const number = patientNumber(patient, index);
                  const isExpanded = expandedPatientId === patient.id;

                  return (
                    <Fragment key={patient.id}>
                      <tr
                        className={`cursor-pointer border-b border-slate-100 transition-colors ${isExpanded ? "bg-[#f7fcff]" : "hover:bg-slate-50"}`}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedPatientId((current) => (current === patient.id ? null : patient.id))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedPatientId((current) => (current === patient.id ? null : patient.id));
                          }
                        }}
                      >
                        <td className="px-4 py-4 font-mono text-slate-500">{number}</td>
                        <td className="px-4 py-4">
                          <Link
                            to={`/patients/${patient.id}/profile`}
                            className="font-bold text-slate-900 hover:text-[var(--action-brand)]"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {patient.firstName || "-"}
                          </Link>
                          <div className="mt-0.5 text-[11px] font-medium text-slate-400">{patient.phone || patient.email || ""}</div>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-700">{patient.lastName || "-"}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {treatmentCount(patient)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {patient.hasDebt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              No tiene
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <HelpTooltip content="Desactivar" position="left">
                            <button
                              className="text-xl font-bold text-slate-500"
                              type="button"
                              aria-label="Desactivar"
                              onClick={(event) => {
                                event.stopPropagation();
                                setConfirmId(patient.id);
                              }}
                            >
                              ...
                            </button>
                          </HelpTooltip>
                        </td>
                      </tr>
                      {isExpanded ? <PatientPreview patient={patient} number={number} /> : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Desactivar paciente"
        description={
          selectedPatient
            ? `Se desactivara a ${selectedPatient.firstName} ${selectedPatient.lastName}. Esta accion aplica baja logica.`
            : "Se desactivara el paciente seleccionado."
        }
        confirmLabel={deactivatePatient.isPending ? "Desactivando..." : "Desactivar"}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => void onConfirmDeactivate()}
      />
    </WarnerSuitePanel>
  );
}
