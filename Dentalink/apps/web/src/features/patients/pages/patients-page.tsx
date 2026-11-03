import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  ChevronRight,
  CreditCard,
  IdCard,
  Mail,
  Phone,
  Search,
  UserRound
} from "lucide-react";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { LoadingState } from "@/components/feedback/loading-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import { usePatientPayments } from "@/features/payments/hooks/use-payments";
import { useDeactivatePatient, usePatient, usePatients } from "../hooks/use-patients";
import type { PatientListItem } from "../services/patients.service";
import { PatientsModuleTabs } from "../components/patients-module-tabs";
import { APP_ROUTES } from "@/lib/routes";
import { formatPatientNumber, getPatientRouteId } from "@/lib/utils/patient-id";

type FilterState = {
  search: string;
  status: string;
  branchId: string;
};

type SegmentFilter = "ALL" | "IN_TREATMENT" | "DEBT" | "NO_APPOINTMENT" | "ALERTS";

const initialFilters: FilterState = {
  search: "",
  status: "",
  branchId: ""
};

function patientNumber(patient: PatientListItem, _index: number) {
  return formatPatientNumber(patient.patientNumber, patient.id);
}

function treatmentCount(patient: PatientListItem) {
  return patient.status === "IN_TREATMENT" ? 3 : 1;
}

function patientInitials(patient: PatientListItem) {
  const first = patient.firstName?.trim().charAt(0) ?? "";
  const last = patient.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "P";
}

function formatPreviewCurrency(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0
  }).format(amount);
}

function PatientPreview({ patient, number }: { patient: PatientListItem; number: string }) {
  const patientDetailQuery = usePatient(patient.id);
  const treatmentPlansQuery = useTreatmentPlans({ patientId: patient.id });
  const paymentsQuery = usePatientPayments(patient.id);

  const patientDetail = patientDetailQuery.data;
  const plans = treatmentPlansQuery.data ?? [];
  const payments = paymentsQuery.data;

  // 1. Contact / Identity
  const agreementName = patientDetail?.agreement?.name || "Sin convenio";
  const docText = patient.documentNumber || patientDetail?.documentNumber || "--";
  const emailText = patient.email || patientDetail?.email || "Sin correo";
  const phoneText = patient.phone || patientDetail?.phone || "Sin teléfono";

  // 2. Treatment Breakdown
  const activePlansCount = plans.filter((p) => ["IN_PROGRESS", "ACCEPTED", "PRESENTED"].includes(p.status)).length;
  const completedPlansCount = plans.filter((p) => p.status === "COMPLETED").length;
  const expiredPlansCount = plans.filter((p) => ["CANCELLED", "REJECTED", "DRAFT"].includes(p.status)).length;

  // 3. Financial Breakdown
  const realizedAmount =
    payments?.balance?.plannedAmount ??
    payments?.payablePlans?.reduce((sum, p) => sum + (p.realizedAmount ?? 0), 0) ??
    0;
  const paidAmount = payments?.balance?.totalPaidAmount ?? payments?.balance?.allocatedPaidAmount ?? 0;
  const balanceToPay = payments?.balance?.outstandingAmount ?? 0;

  return (
    <tr className="border-b border-slate-200 bg-white">
      <td colSpan={7} className="px-6 py-6 bg-[#f8fafc]/70">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Column 1: Identity & Contact */}
          <div className="flex flex-col justify-between pr-0 md:pr-8 pb-6 md:pb-0">
            <div className="flex items-center gap-5">
              {/* Circular Avatar Graphic */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#d0f0ff] border-2 border-[#b8e5fa] text-2xl font-bold text-[#0784d8] shadow-sm">
                {patientInitials(patient)}
              </div>

              {/* Contact list with icons */}
              <div className="space-y-2 text-[13px] text-slate-700 font-medium min-w-0">
                <div className="flex items-center gap-2.5">
                  <IdCard className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate">{docText}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate">{emailText}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate">{phoneText}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="truncate text-slate-600">{agreementName}</span>
                </div>
              </div>
            </div>

            {/* Bottom link */}
            <div className="mt-6 flex justify-end">
              <Link
                to={APP_ROUTES.patients.profile(getPatientRouteId(patient))}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0784d8] hover:text-[#0668ba] hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Ir a datos personales
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Column 2: Treatments Breakdown */}
          <div className="flex flex-col justify-between px-0 md:px-8 py-6 md:py-0">
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Activos</span>
                <span className="font-bold text-slate-900">{activePlansCount}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Finalizados</span>
                <span className="font-bold text-slate-900">{completedPlansCount}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Expirados</span>
                <span className="font-bold text-slate-900">{expiredPlansCount}</span>
              </div>
            </div>

            {/* Bottom link */}
            <div className="mt-6 flex justify-end">
              <Link
                to={APP_ROUTES.patients.treatments(getPatientRouteId(patient))}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0784d8] hover:text-[#0668ba] hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Ir a tratamientos
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Column 3: Financial Breakdown / Recaudación */}
          <div className="flex flex-col justify-between pl-0 md:pl-8 pt-6 md:pt-0">
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Realizado</span>
                <span className="font-bold text-slate-900">{formatPreviewCurrency(realizedAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Abonado</span>
                <span className="font-bold text-slate-900">{formatPreviewCurrency(paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 font-medium">Saldo por abonar</span>
                <span className="font-bold text-slate-900">{formatPreviewCurrency(balanceToPay)}</span>
              </div>
            </div>

            {/* Bottom link */}
            <div className="mt-6 flex justify-end">
              <Link
                to={APP_ROUTES.patients.payments(getPatientRouteId(patient))}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0784d8] hover:text-[#0668ba] hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Ir a recaudación
                <ChevronRight className="h-4 w-4" />
              </Link>
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
  const [activeSegment, setActiveSegment] = useState<SegmentFilter>("ALL");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.branchId, activeBranchId, activeSegment]);

  const branchQuery = useBranches(undefined, "ACTIVE");
  const isGlobalHeaderSearch =
    Boolean(filters.search.trim()) && !filters.branchId && !searchParams.has("branchId");
  const selectedBranchId = isGlobalHeaderSearch ? "" : filters.branchId || activeBranchId;
  const patientQuery = usePatients({
    search: filters.search || undefined,
    status: filters.status || undefined,
    branchId: selectedBranchId || undefined,
    page,
    pageSize: PAGE_SIZE
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

  const segmentCounts = useMemo(() => {
    const list = patientQuery.data ?? [];
    return {
      all: list.length,
      inTreatment: list.filter((p) => p.status === "IN_TREATMENT").length,
      debt: list.filter((p) => p.hasDebt).length,
      noAppointment: list.filter((p) => !p.hasFutureAppointment).length,
      alerts: list.filter((p) => p.hasCriticalAlert).length
    };
  }, [patientQuery.data]);

  const displayedPatients = useMemo(() => {
    const list = patientQuery.data ?? [];
    if (activeSegment === "IN_TREATMENT") return list.filter((p) => p.status === "IN_TREATMENT");
    if (activeSegment === "DEBT") return list.filter((p) => p.hasDebt);
    if (activeSegment === "NO_APPOINTMENT") return list.filter((p) => !p.hasFutureAppointment);
    if (activeSegment === "ALERTS") return list.filter((p) => p.hasCriticalAlert);
    return list;
  }, [patientQuery.data, activeSegment]);

  const actions = (
    <Link
      to={APP_ROUTES.patients.new}
      className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#00805b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#006b45] shadow-xs"
    >
      + Nuevo paciente
    </Link>
  );

  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;

  return (
    <WarnerSuitePanel>
      <PatientsModuleTabs actions={actions} />

      <div className="p-4 sm:p-5">
        {/* Quick Filter Segment Buttons */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSegment("ALL")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeSegment === "ALL"
                ? "bg-[#0784d8] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Todos
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeSegment === "ALL" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {segmentCounts.all}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment("IN_TREATMENT")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeSegment === "IN_TREATMENT"
                ? "bg-[#0784d8] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            En tratamiento
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeSegment === "IN_TREATMENT"
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {segmentCounts.inTreatment}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment("DEBT")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeSegment === "DEBT"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-red-50/50 hover:text-red-700"
            }`}
          >
            Con deuda
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeSegment === "DEBT" ? "bg-white/25 text-white" : "bg-red-100 text-red-700"
              }`}
            >
              {segmentCounts.debt}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment("NO_APPOINTMENT")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeSegment === "NO_APPOINTMENT"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-amber-50/50 hover:text-amber-800"
            }`}
          >
            Sin cita agendada
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeSegment === "NO_APPOINTMENT"
                  ? "bg-white/25 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {segmentCounts.noAppointment}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment("ALERTS")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeSegment === "ALERTS"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-rose-50/50 hover:text-rose-700"
            }`}
          >
            Alertas médicas
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeSegment === "ALERTS" ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700"
              }`}
            >
              {segmentCounts.alerts}
            </span>
          </button>
        </div>

        {/* Filter Bar Card */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[280px]">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Búsqueda rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-14 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-[#0784d8] focus:ring-1 focus:ring-[#0784d8]"
                  placeholder="Buscar por nombre, documento o teléfono..."
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitFilters();
                  }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-500">
                  Ctrl K
                </span>
              </div>
            </div>

            {/* Filter Selects */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Estado</label>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-[#0784d8]"
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="">Todos los estados</option>
                  <option value="NEW">Nuevos</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="IN_TREATMENT">En tratamiento</option>
                  <option value="DEBTOR">Morosos</option>
                </select>
              </div>

              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Sucursal</label>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-[#0784d8]"
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
                  <option value="">Dental + Suc. León Valle</option>
                  {branchQuery.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="h-10 rounded-lg bg-[#1665d8] px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#1253b3]"
                onClick={() => submitFilters()}
              >
                Buscar pacientes
              </button>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        {patientQuery.isLoading ? (
          <LoadingState message="Cargando pacientes..." />
        ) : !displayedPatients.length ? (
          <EmptyState
            title="Sin pacientes"
            description="No hay pacientes para el segmento o filtros seleccionados."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-[70px] px-4 py-3.5">#</th>
                  <th className="px-4 py-3.5 text-slate-700">Paciente</th>
                  <th className="px-4 py-3.5">Próxima cita</th>
                  <th className="px-4 py-3.5 text-center">Tratamientos</th>
                  <th className="px-4 py-3.5">Estado financiero</th>
                  <th className="px-4 py-3.5">Alertas</th>
                  <th className="w-[110px] px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPatients.map((patient, index) => {
                  const number = patientNumber(patient, index);
                  const isExpanded = expandedPatientId === patient.id;

                  return (
                    <Fragment key={patient.id}>
                      <tr
                        className={`cursor-pointer transition-colors duration-150 ${
                          isExpanded ? "bg-[#f4faff]" : "hover:bg-slate-50/80"
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedPatientId((current) => (current === patient.id ? null : patient.id))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedPatientId((current) =>
                              current === patient.id ? null : patient.id
                            );
                          }
                        }}
                      >
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-400">
                          {number}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e0f2fe] text-xs font-bold text-[#0284c7]">
                              {patientInitials(patient)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={APP_ROUTES.patients.profile(getPatientRouteId(patient))}
                                className="font-bold text-slate-900 hover:text-[#0784d8] hover:underline block truncate"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {patient.firstName} {patient.lastName}
                              </Link>
                              <div className="text-[11px] font-medium text-slate-400 truncate">
                                {patient.phone || patient.email || "Sin contacto"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {patient.hasFutureAppointment ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                              <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Agendada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/80">
                              <CalendarX className="h-3.5 w-3.5 text-amber-600" />
                              Sin cita
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-100 px-2.5 text-xs font-bold text-slate-700">
                            {treatmentCount(patient)} {patient.status === "IN_TREATMENT" ? "Activo" : "Plan"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {patient.hasDebt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200/80">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Con deuda
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Al día ($0)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {patient.hasCriticalAlert ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Alerta médica
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Sin alertas</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              to={`${APP_ROUTES.agenda.day}?patientId=${getPatientRouteId(patient)}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-sky-50 hover:text-[#0784d8]"
                              title="Agendar cita"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              to={APP_ROUTES.patients.payments(getPatientRouteId(patient))}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              title="Recaudación / Pagos"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </Link>
                            <HelpTooltip content="Desactivar" position="left">
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
                                type="button"
                                aria-label="Desactivar"
                                onClick={() => setConfirmId(patient.id)}
                              >
                                •••
                              </button>
                            </HelpTooltip>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? <PatientPreview patient={patient} number={number} /> : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/60 px-5 py-3.5 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(patientQuery.data?.length ?? 0) < PAGE_SIZE}
                  className="relative ml-3 inline-flex items-center rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Página <span className="font-bold text-slate-800">{page}</span>
                  </p>
                </div>
                <div>
                  <nav aria-label="Pagination" className="isolate inline-flex -space-x-px rounded-xl shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center rounded-l-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="relative inline-flex items-center border border-slate-200/80 bg-slate-50 px-4 py-2 text-xs font-bold text-[#0784d8]">
                      {page}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(patientQuery.data?.length ?? 0) < PAGE_SIZE}
                      className="relative inline-flex items-center rounded-r-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmId && selectedPatient ? (
        <ConfirmDialog
          open={Boolean(confirmId)}
          title="Desactivar paciente"
          description={`¿Seguro que deseas desactivar a "${selectedPatient.firstName} ${selectedPatient.lastName}"? Esta acción archivará su expediente temporalmente.`}
          confirmLabel="Desactivar"
          onConfirm={() => void onConfirmDeactivate()}
          onCancel={() => setConfirmId(null)}
        />
      ) : null}
    </WarnerSuitePanel>
  );
}
