import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, Maximize2, AlertCircle, ArrowUp, ArrowDown, CheckCircle2, Columns, Calendar, Search, Filter } from "lucide-react";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppointmentModal, type AppointmentSubmitOptions } from "@/features/agenda/components/appointment-modal";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { usePatients, useCreatePatient } from "@/features/patients/hooks/use-patients";
import { useCreateAppointment } from "@/features/agenda/hooks/use-appointments";
import { useTreatmentMutations } from "@/features/treatments/hooks/use-treatments";
import type { AppointmentPayload } from "@/features/agenda/services/appointments.service";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { DataTable } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { PatientsModuleTabs } from "../components/patients-module-tabs";
import { useOrthodonticPatientsReport, useOrthodonticReportSummary, useDraftOrthodonticAppointment } from "../hooks/use-orthodontics-report";
import { resolveApiBaseUrl } from "@/lib/api/http-client";
import type { OrthodonticPatientRow, OrthodonticReportFilters } from "../services/orthodontics.service";

export function PatientsOrthodontiaPage() {
  const [filters, setFilters] = useState<OrthodonticReportFilters>({ page: 1, limit: 50 });
  const [searchValue, setSearchValue] = useState("");
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchValue || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const { data: reportData, isLoading, isError, error } = useOrthodonticPatientsReport(filters);
  const { data: summaryData, isLoading: isLoadingSummary } = useOrthodonticReportSummary(filters.branchId);

  const handleDownload = () => {
    const url = new URL(`${resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV)}/orthodontics/patients-report/export`);
    if (filters.branchId) url.searchParams.append("branchId", filters.branchId);
    
    // Auth token handled by authStoreApi in a real scenario, usually passed via headers 
    // but for simple window.open download, a query token or interceptor is needed. 
    // Assuming standard cookie/token proxy for this demo:
    window.open(url.toString(), '_blank');
  };

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {});
  };

  if (isError) return <ErrorState message={(error as any)?.message || "Ocurrió un error al cargar el reporte"} />;

  return (
    <WarnerSuitePanel className="min-h-[720px]">
      <PatientsModuleTabs />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Seguimiento clínico
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pacientes de Ortodoncia</h1>
            <p className="mt-1 text-sm text-slate-500">
              Panel operativo de seguimiento para todos los tratamientos ortodónticos activos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleDownload} disabled={isLoading || !reportData?.data.length}>
              <Download className="mr-1.5 h-4 w-4" />
              Descargar reporte
            </Button>
            <Button variant="secondary" onClick={requestFullscreen}>
              <Maximize2 className="mr-1.5 h-4 w-4" />
              Pantalla completa
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric 
            label="Pacientes activos" 
            value={summaryData?.activePatients ?? 0} 
            loading={isLoadingSummary} 
          />
          <Metric 
            label="Pacientes atrasados" 
            value={summaryData?.delayedPatients ?? 0} 
            tone="danger" 
            loading={isLoadingSummary} 
          />
          <Metric 
            label="Sin cita futura" 
            value={summaryData?.withoutFutureAppointment ?? 0} 
            tone="warning" 
            loading={isLoadingSummary} 
          />
          <Metric 
            label="1 a 6 años" 
            value={summaryData?.age1to6 ?? 0} 
            loading={isLoadingSummary} 
          />
          <Metric 
            label="6 a 12 años" 
            value={summaryData?.age6to12 ?? 0} 
            loading={isLoadingSummary} 
          />
          <Metric 
            label="Mayores de 12 años" 
            value={summaryData?.ageOver12 ?? 0} 
            loading={isLoadingSummary} 
          />
        </div>
        
        {summaryData && summaryData.missingBirthDate > 0 && (
           <p className="text-xs text-slate-400 text-right">
             Pacientes sin fecha de nacimiento: {summaryData.missingBirthDate}
           </p>
        )}

        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre de paciente..." 
              className="pl-9"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select 
              className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0879d5]"
              value={filters.delayStatus || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, delayStatus: e.target.value || undefined, page: 1 }))}
            >
              <option value="">Todos los estados</option>
              <option value="DELAYED">Atrasados</option>
              <option value="ON_TRACK">Al día (On Track)</option>
              <option value="AHEAD">Adelantados</option>
            </select>
          </div>
        </div>

        <OrthodonticTable 
           rows={reportData?.data ?? []} 
           isLoading={isLoading}
           branchId={filters.branchId} 
        />
      </div>
    </WarnerSuitePanel>
  );
}

function Metric({
  label,
  value,
  tone = "brand",
  loading = false,
}: {
  label: string;
  value: number;
  tone?: "brand" | "warning" | "danger";
  loading?: boolean;
}) {
  const toneClass =
    tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-[#0879d5]";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      {loading ? (
        <div className="h-7 w-12 animate-pulse rounded bg-slate-200" />
      ) : (
        <span className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</span>
      )}
    </div>
  );
}

function ProgressDifference({ diff }: { diff: any }) {
  if (!diff || diff.status === "NOT_CALCULABLE") {
     return <div className="flex items-center gap-1 text-slate-400">
       <AlertCircle className="w-4 h-4" />
       <span className="text-xs">N/D</span>
     </div>;
  }
  
  if (diff.status === "DELAYED") {
    return <div className="flex items-center gap-1 text-red-600 font-medium">
      <ArrowDown className="w-4 h-4" />
      <span className="text-sm">{diff.displayValue} p.p.</span>
    </div>;
  }
  
  if (diff.status === "AHEAD") {
    return <div className="flex items-center gap-1 text-green-600 font-medium">
      <ArrowUp className="w-4 h-4" />
      <span className="text-sm">+{diff.displayValue} p.p.</span>
    </div>;
  }
  
  return <div className="flex items-center gap-1 text-emerald-600 font-medium">
    <CheckCircle2 className="w-4 h-4" />
    <span className="text-sm">0 p.p.</span>
  </div>;
}

function CalendarProgressBar({ data }: { data: any }) {
  if (!data || !data.isCalculable) {
    return <div className="flex items-center gap-2"><span className="text-sm text-slate-500 w-8">N/D</span><div className="h-2 w-24 bg-slate-100 rounded"></div></div>;
  }
  const pct = Math.min(100, Math.max(0, data.percentage));
  return (
    <div className="flex items-center gap-2 group relative">
      <span className="text-sm font-medium w-9 text-slate-700">{Math.round(data.percentage)}%</span>
      <div className="h-2.5 w-24 bg-slate-100 rounded border border-slate-200 overflow-hidden">
        <div className={`h-full ${data.isExceeded ? 'bg-sky-600' : 'bg-[#0879d5]'}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

function ControlProgressBar({ data, status }: { data: any, status: string }) {
  if (!data || !data.isCalculable) {
    return <div className="flex items-center gap-2"><span className="text-sm text-slate-500 w-8">N/D</span><div className="h-2 w-24 bg-slate-100 rounded"></div></div>;
  }
  const pct = Math.min(100, Math.max(0, data.percentage));
  let color = "bg-emerald-500";
  if (status === "DELAYED") color = "bg-red-500";
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium w-9 text-slate-700">{data.displayPercentage}%</span>
      <div className="h-2.5 w-24 bg-slate-100 rounded border border-slate-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

function OrthodonticTable({ rows, isLoading, branchId }: { rows: OrthodonticPatientRow[], isLoading: boolean, branchId?: string }) {
  const [schedulingRow, setSchedulingRow] = useState<OrthodonticPatientRow | null>(null);

  // Persistencia de columnas en localStorage
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("orthodontic_table_columns");
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore malformed local preferences and restore the safe default below.
    }
    return {
      patientAge: true,
      patientMobile: true,
      professionalName: true,
      calendarProgress: true,
      realProgress: true,
      progressDifference: true,
      lastEvolutionAt: true,
      suggestedAppointmentAt: true,
      scheduledAppointmentAt: true,
    };
  });

  useEffect(() => {
    localStorage.setItem("orthodontic_table_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) return <LoadingState message="Cargando panel de ortodoncia..." />;
  if (!rows.length) return <EmptyState title="Sin resultados" description="No se encontraron tratamientos ortodónticos activos." />;

  const allColumns = [
    {
      key: "patientName",
      title: "Paciente",
      alwaysVisible: true,
      render: (r: any) => (
        <Link to={`/patients/${r.patientId}/treatments?planId=${r.treatmentPlanId}`} className="font-semibold text-[#0879d5] hover:underline">
          {r.patientName} {r.patientLastName}
        </Link>
      )
    },
    { key: "patientAge", title: "Edad", render: (r: any) => r.patientAge },
    { key: "patientMobile", title: "Móvil", render: (r: any) => r.patientMobile || "-" },
    { key: "professionalName", title: "Profesional", render: (r: any) => r.professionalName },
    { key: "calendarProgress", title: "Progreso Calendario", render: (r: any) => (
        <Link to={`/patients/${r.patientId}/treatments?planId=${r.treatmentPlanId}`}>
          <CalendarProgressBar data={r.calendarProgress} />
        </Link>
      )
    },
    { key: "realProgress", title: "Progreso Real", render: (r: any) => (
        <Link to={`/patients/${r.patientId}/treatments?planId=${r.treatmentPlanId}`}>
          <ControlProgressBar data={r.controlProgress} status={r.progressDifference?.status} />
        </Link>
      ) 
    },
    {
      key: "progressDifference",
      title: <div className="flex items-center gap-1">Diferencia <HelpTooltip content="Progreso real menos progreso calendario" /></div>,
      render: (r: any) => (
        <Link to={`/patients/${r.patientId}/treatments?planId=${r.treatmentPlanId}`}>
          <ProgressDifference diff={r.progressDifference} />
        </Link>
      )
    },
    { key: "lastEvolutionAt", title: "Última Ev.", render: (r: any) => r.lastEvolution?.performedAt ? (
        <Link to={`/patients/${r.patientId}/treatments?planId=${r.treatmentPlanId}`}>
          <span className="text-slate-700 hover:underline">{new Date(r.lastEvolution.performedAt).toLocaleDateString()}</span>
        </Link>
      ) : "-" },
    { key: "suggestedAppointmentAt", title: "Cita Sugerida", render: (r: any) => r.nextControl?.suggestedAt ? new Date(r.nextControl.suggestedAt).toLocaleDateString() : "Sin fecha" },
    { 
      key: "scheduledAppointmentAt", 
      title: "Cita Agendada", 
      render: (r: any) => r.nextControl?.scheduledAt ? (
        <span className="text-slate-700">{new Date(r.nextControl.scheduledAt).toLocaleDateString()}</span>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setSchedulingRow(r)}>
          Agendar
        </Button>
      ) 
    },
  ];

  const activeColumns = allColumns.filter(c => (c as any).alwaysVisible || visibleColumns[c.key]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="relative group">
          <Button variant="secondary" size="sm">
            <Columns className="mr-1.5 h-4 w-4" />
            Columnas
          </Button>
          <div className="absolute right-0 top-full mt-1 hidden w-48 flex-col rounded-md border border-slate-200 bg-white p-2 shadow-lg group-hover:flex z-50 before:absolute before:-top-3 before:inset-x-0 before:h-3">
            {allColumns.filter(c => !(c as any).alwaysVisible).map(c => (
              <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 rounded cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300"
                  checked={visibleColumns[c.key]} 
                  onChange={() => toggleColumn(c.key)} 
                />
                <span className="text-slate-700 truncate">{typeof c.title === 'string' ? c.title : c.key}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-auto border border-slate-200 bg-white">
        <DataTable 
          columns={activeColumns as any} 
          rows={rows as any} 
          empty={<div className="p-4 text-center text-slate-500">No se encontraron resultados</div>}
        />
      </div>

      {schedulingRow && (
        <DeferredOrthodonticAppointmentModal
          schedulingRow={schedulingRow}
          branchId={branchId}
          onClose={() => setSchedulingRow(null)}
        />
      )}
    </div>
  );
}

function DeferredOrthodonticAppointmentModal({ 
  schedulingRow, 
  branchId, 
  onClose 
}: { 
  schedulingRow: OrthodonticPatientRow | null, 
  branchId?: string, 
  onClose: () => void 
}) {
  const queryClient = useQueryClient();
  
  // Deferred hooks: only fetch if modal is open
  const enabled = !!schedulingRow;
  
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { branchId, pageSize: 100 });
  const chairs = useChairs(undefined, "true");
  // Limit to 15 patients or just search, but for safety in this modal, we'll keep it low or use the specific patient.
  const patients = usePatients({ branchId, pageSize: 50 }); 
  
  const createPatient = useCreatePatient("appointment");
  const createAppointment = useCreateAppointment();
  const treatmentMutations = useTreatmentMutations();

  const handleAppointmentSubmit = async (payloads: AppointmentPayload[], options?: AppointmentSubmitOptions) => {
    if (payloads.length === 0) return;
    try {
      for (const payload of payloads) {
        await createAppointment.mutateAsync(payload);
      }
      // Cache invalidation to refresh the table!
      queryClient.invalidateQueries({ queryKey: ["orthodontics", "patients-report"] });
      toast.success("Cita agendada correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error al agendar");
      throw e;
    }
  };

  if (!schedulingRow) return null;

  return (
    <AppointmentModal
      open={true}
      initialValues={{
        patientId: schedulingRow.patientId,
        branchId: branchId || branches.data?.[0]?.id || "",
        treatmentPlanId: schedulingRow.treatmentPlanId
      }}
      defaultDate={schedulingRow?.nextControl?.suggestedAt ? schedulingRow.nextControl.suggestedAt.slice(0, 10) : undefined}
      branches={branches.data ?? []}
      professionals={professionals.data ?? []}
      chairs={chairs.data ?? []}
      patients={patients.data ?? []}
      onClose={onClose}
      onSubmit={handleAppointmentSubmit}
      onCreatePatient={async (payload) => (await createPatient.mutateAsync(payload)).patient}
      onCreateTreatmentPlan={(payload) => treatmentMutations.createTreatmentPlan.mutateAsync(payload)}
    />
  );
}
