import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock3, MapPin, ShieldAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { PatientsModuleTabs } from "../components/patients-module-tabs";
import {
  AnalyticsFilterBar,
  type PatientAnalyticsFilterValue
} from "../components/analysis/analytics-filter-bar";
import {
  ConversionSection,
  DemographicsSection,
  GlobalMetricsSection
} from "../components/analysis/patient-analytics-charts";
import { AnalyticsDrilldownDrawer } from "../components/analysis/analytics-drilldown-drawer";
import {
  usePatientsAnalysis,
  useRefreshPatientsAnalysis
} from "../hooks/use-patients";
import type { PatientAnalysisQuery } from "../services/patients.service";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function twelveMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 11, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatTimestamp(value?: string) {
  if (!value) return "Sin corte";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function PatientsAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const branches = useBranches(undefined, "ACTIVE");
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const { hasPermission } = usePermissions();
  const canViewAllBranches =
    hasPermission("patient_analytics.view_all_branches") ||
    hasPermission("reports.read") ||
    hasPermission("branches.view_all");
  const defaultBranch = searchParams.get("branches") === "all"
    ? "all"
    : searchParams.get("branchId") || activeBranchId || branches.data?.[0]?.id || "";
  const appliedFilters = useMemo<PatientAnalyticsFilterValue>(
    () => ({
      from: searchParams.get("from") || twelveMonthsAgo(),
      to: searchParams.get("to") || today(),
      branchSelection: defaultBranch,
      granularity:
        (searchParams.get("granularity") as PatientAnalyticsFilterValue["granularity"] | null) ??
        "auto"
    }),
    [defaultBranch, searchParams]
  );
  const [draft, setDraft] = useState(appliedFilters);
  const [detail, setDetail] = useState<{ metric: string; title: string } | null>(null);

  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const query = useMemo<PatientAnalysisQuery>(() => {
    const isAll = appliedFilters.branchSelection === "all";
    return {
      from: appliedFilters.from,
      to: appliedFilters.to,
      branchId: !isAll && appliedFilters.branchSelection ? appliedFilters.branchSelection : undefined,
      branchIds: isAll ? branches.data?.map((branch) => branch.id) : undefined,
      granularity: appliedFilters.granularity
    };
  }, [appliedFilters, branches.data]);
  const analysis = usePatientsAnalysis(query);
  const refresh = useRefreshPatientsAnalysis();

  const apply = () => {
    const next = new URLSearchParams();
    next.set("from", draft.from);
    next.set("to", draft.to);
    next.set("granularity", draft.granularity);
    if (draft.branchSelection === "all") next.set("branches", "all");
    else if (draft.branchSelection) next.set("branchId", draft.branchSelection);
    setSearchParams(next);
  };

  const clear = () => {
    const next: PatientAnalyticsFilterValue = {
      from: twelveMonthsAgo(),
      to: today(),
      branchSelection: activeBranchId || branches.data?.[0]?.id || "",
      granularity: "auto"
    };
    setDraft(next);
    const params = new URLSearchParams({ from: next.from, to: next.to, granularity: "auto" });
    if (next.branchSelection) params.set("branchId", next.branchSelection);
    setSearchParams(params);
  };

  return (
    <WarnerSuitePanel>
      <PatientsModuleTabs />
      <div className="space-y-7 p-4 pb-10 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Analisis de pacientes"
            description="Conversion, composicion y salud operativa de sucursales autorizadas."
            helpText="Las cifras se calculan con reglas versionadas. Abre cada indicador para revisar su universo y registros fuente."
          />
          <div className="flex flex-wrap gap-2">
            <Badge value="Fuente en vivo" tone="success" />
            <Badge value={`Metricas v${analysis.data?.metadata.metricVersion ?? "1.0.0"}`} />
          </div>
        </div>

        <AnalyticsFilterBar
          value={draft}
          branches={branches.data ?? []}
          canViewAllBranches={canViewAllBranches}
          refreshing={refresh.isPending || analysis.isFetching}
          onChange={setDraft}
          onApply={apply}
          onClear={clear}
          onRefresh={() => void refresh.mutateAsync(query)}
        />

        {analysis.data ? (
          <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 text-[11px] text-[var(--text-secondary)] sm:grid-cols-2 xl:grid-cols-4">
            <MetadataItem
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Ultima actualizacion"
              value={formatTimestamp(analysis.data.metadata.lastUpdatedAt)}
            />
            <MetadataItem
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Fecha de corte"
              value={formatTimestamp(analysis.data.metadata.cutoffAt)}
            />
            <MetadataItem
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Zona horaria"
              value={analysis.data.metadata.timezone}
            />
            <MetadataItem
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Sucursales incluidas"
              value={analysis.data.metadata.branches.map((branch) => branch.name).join(", ")}
            />
          </div>
        ) : null}

        {analysis.isLoading ? (
          <LoadingState message="Calculando analisis de pacientes..." />
        ) : analysis.isError ? (
          <ErrorState message={analysis.error.message} />
        ) : analysis.data ? (
          <>
            {!analysis.data.capabilities.canReadFinancial ? (
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Vista clínica activa. API omitió deuda e importes de presupuestos porque sesión no tiene permiso financiero.
              </div>
            ) : null}
            <ConversionSection analysis={analysis.data} onOpenDetail={(metric, title) => setDetail({ metric, title })} />
            <DemographicsSection analysis={analysis.data} />
            <GlobalMetricsSection analysis={analysis.data} onOpenDetail={(metric, title) => setDetail({ metric, title })} />
          </>
        ) : null}
      </div>

      <AnalyticsDrilldownDrawer
        metric={detail?.metric ?? null}
        title={detail?.title ?? "Detalle"}
        filters={query}
        canExport={Boolean(analysis.data?.capabilities.canExport)}
        onClose={() => setDetail(null)}
      />
    </WarnerSuitePanel>
  );
}

function MetadataItem({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-[var(--brand-primary)]">{icon}</span>
      <span className="min-w-0">
        <strong className="block font-semibold text-[var(--text-primary)]">{label}</strong>
        <span className="block truncate">{value}</span>
      </span>
    </div>
  );
}
