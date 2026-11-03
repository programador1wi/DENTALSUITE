import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileSearch,
  Info,
  LoaderCircle,
  MailCheck,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  UsersRound
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  createCampaign,
  exportMarketingReport,
  getMarketingReports,
  listTemplates,
  previewMarketingReport,
  scheduleCampaign,
  sendCampaignNow,
  sendCampaignTest,
  type MarketingPatientRow,
  type MarketingReportDefinition,
  type MarketingReportResponse,
  type ReportParameter,
  type SenderConfiguration
} from "../services/email-marketing.service";

const TREATED_PATIENTS_REPORT = "PATIENTS_TREATED_BY_PROFESSIONAL";

export function MarketingReportsPanel({
  sender,
  selectedReportCode,
  campaignOpen,
  onReportChange,
  onOpenCampaign,
  onCloseCampaign,
  onOpenSettings,
  onOpenCampaigns
}: {
  sender: SenderConfiguration;
  selectedReportCode?: string;
  campaignOpen?: boolean;
  onReportChange?: (reportCode?: string) => void;
  onOpenCampaign?: (reportCode: string) => void;
  onCloseCampaign?: (reportCode: string) => void;
  onOpenSettings: () => void;
  onOpenCampaigns?: () => void;
}) {
  const catalog = useQuery({ queryKey: ["email-marketing", "reports"], queryFn: getMarketingReports });
  const [report, setReport] = useState<MarketingReportDefinition | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [response, setResponse] = useState<MarketingReportResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportScope, setExportScope] = useState<"ALL" | "ELIGIBLE" | "SELECTED" | "INELIGIBLE">("ALL");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [selectingAll, setSelectingAll] = useState(false);
  const registeredEmailOnly = report?.code === TREATED_PATIENTS_REPORT;
  const isWizardOpen = campaignOpen ?? wizardOpen;

  const clearReportState = useCallback(() => {
    setReport(null);
    setParameters({});
    setResponse(null);
    setSearch("");
    setSelected(new Set());
    setBranchId("");
    setExportScope("ALL");
    setWizardOpen(false);
  }, []);

  useEffect(() => {
    if (!onReportChange) return;
    if (!catalog.data) return;
    if (!selectedReportCode) {
      if (report) clearReportState();
      return;
    }
    if (report?.code === selectedReportCode) return;
    const definition = catalog.data.find((item) => item.code === selectedReportCode);
    if (!definition) {
      toast.error("El reporte solicitado no existe");
      onReportChange?.();
      return;
    }
    setReport(definition);
    setParameters(buildDefaultReportParameters(definition, branchId));
    setResponse(null);
    setSearch("");
    setSelected(new Set());
    setExportScope("ALL");
    setWizardOpen(false);
  }, [branchId, catalog.data, clearReportState, onReportChange, report, selectedReportCode]);

  const preview = useMutation({
    mutationFn: ({
      reportCode = report!.code,
      page = 1,
      append: _append = false,
      customPageSize
    }: {
      reportCode?: string;
      page?: number;
      append?: boolean;
      customPageSize?: number;
    }) =>
      previewMarketingReport(reportCode, {
        parameters,
        page,
        pageSize: customPageSize ?? 50,
        search: search || undefined
      }),
    onSuccess: (data, variables) =>
      setResponse((current) =>
        variables.append && current
          ? { ...data, items: deduplicateRows([...current.items, ...data.items]) }
          : data
      ),
    onError: (error: Error) => toast.error(error.message)
  });
  const exporting = useMutation({
    mutationFn: () =>
      exportMarketingReport(report!.code, {
        parameters,
        scope: exportScope,
        selectedPatientIds: [...selected]
      }),
    onSuccess: (data) =>
      toast.success("Reporte Excel generado", {
        description: `${data.rowCount} filas incluidas en un archivo XLSX auditado.`
      }),
    onError: (error: Error) => toast.error(error.message)
  });

  const chooseReport = (definition: MarketingReportDefinition) => {
    if (report?.code === definition.code) {
      clearReportState();
      onReportChange?.();
      return;
    }
    const defaults = buildDefaultReportParameters(definition, branchId);
    setReport(definition);
    setParameters(defaults);
    setResponse(null);
    setSelected(new Set());
    setExportScope("ALL");
    onReportChange?.(definition.code);
  };

  const changeBranch = (value: string) => {
    setBranchId(value);
    if (report) setParameters((current) => ({ ...current, branchId: value }));
  };

  const reset = () => {
    if (selected.size && !window.confirm("La selección actual se perderá. ¿Generar un reporte nuevo?"))
      return;
    clearReportState();
    onReportChange?.();
  };

  const toggle = (row: MarketingPatientRow) => {
    if (!row.eligible) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.patientId)) next.delete(row.patientId);
      else next.add(row.patientId);
      return next;
    });
  };

  const selectAllEligible = async () => {
    if (!report || !response) return;
    if (!response.pagination.total) {
      toast.info("El reporte no tiene pacientes para seleccionar");
      return;
    }
    setSelectingAll(true);
    try {
      const allRows = await fetchAllReportRows(report.code, parameters, response.pagination.total, search);
      const eligibleRows = allRows.filter((row) => row.eligible);
      setResponse({
        ...response,
        items: allRows,
        pagination: { ...response.pagination, page: 1, pageSize: allRows.length, hasMore: false },
        summary: {
          ...response.summary,
          visible: allRows.length,
          eligible: eligibleRows.length,
          ineligible: allRows.length - eligibleRows.length
        }
      });
      setSelected(new Set(eligibleRows.map((row) => row.patientId)));
      if (!eligibleRows.length) {
        toast.warning(
          registeredEmailOnly
            ? "No hay pacientes con correo para seleccionar"
            : "No hay pacientes elegibles para seleccionar",
          {
            description: summarizeEligibilityBlocks(allRows)
          }
        );
      } else {
        toast.success(
          `${eligibleRows.length} pacientes ${registeredEmailOnly ? "con correo" : "elegibles"} seleccionados`,
          {
            description: registeredEmailOnly
              ? "Todos pertenecen al profesional elegido y tienen correo registrado."
              : "La selección se conservó sin duplicados."
          }
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible seleccionar todos los pacientes");
    } finally {
      setSelectingAll(false);
    }
  };

  if (catalog.isLoading) return <LoadingState message="Cargando biblioteca de reportes..." />;
  if (catalog.isError) return <ErrorState message={catalog.error.message} />;

  return (
    <div className="space-y-4">
      <SenderNotice sender={sender} onOpenSettings={onOpenSettings} />
      {!response ? (
        <ReportLibrary
          reports={catalog.data ?? []}
          activeReport={report}
          parameters={parameters}
          sender={sender}
          branchId={branchId}
          isGenerating={preview.isPending}
          onChoose={chooseReport}
          onBranchChange={changeBranch}
          onParameterChange={(key, value) => setParameters((current) => ({ ...current, [key]: value }))}
          onGenerate={(definition) => preview.mutate({ reportCode: definition.code, page: 1 })}
        />
      ) : report ? (
        <>
          <Card className="hover:translate-y-0">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <button
                  type="button"
                  className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-brand)]"
                  onClick={reset}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Biblioteca de reportes
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge value={report.category} tone="brand" />
                  <h3 className="min-w-0 font-semibold text-[var(--text-primary)]">{report.name}</h3>
                </div>
                <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[var(--text-secondary)]">
                  {report.description}
                </p>
              </div>
              <Button
                className="shrink-0"
                onClick={() => preview.mutate({ page: 1 })}
                disabled={preview.isPending}
              >
                <FileSearch className="h-4 w-4" />
                Generar reporte
              </Button>
            </div>
            <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {[...report.requiredParameters, ...report.optionalParameters].map((parameter) => (
                <ParameterField
                  key={parameter.key}
                  parameter={parameter}
                  value={parameters[parameter.key]}
                  onChange={(value) => setParameters((current) => ({ ...current, [parameter.key]: value }))}
                  sender={sender}
                />
              ))}
              <Field label="Buscar en resultados">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
                  <Input
                    className="pl-9"
                    value={search}
                    placeholder="Nombre, documento o correo"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </Field>
            </div>
          </Card>
          {preview.isPending && !response && (
            <LoadingState
              message={
                registeredEmailOnly
                  ? "Consultando pacientes atendidos con correo registrado..."
                  : "Evaluando pacientes y políticas de contacto..."
              }
            />
          )}
          {response && (
            <>
              <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <ResultsTable
                  response={response}
                  selected={selected}
                  onToggle={toggle}
                  onSelectPage={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      response.items.filter((row) => row.eligible).forEach((row) => next.add(row.patientId));
                      return next;
                    })
                  }
                  onClear={() => setSelected(new Set())}
                  report={report}
                />
                <SelectionPanel
                  response={response}
                  selectedCount={selected.size}
                  registeredEmailOnly={registeredEmailOnly}
                  selectingAll={selectingAll}
                  onCreate={() => {
                    if (onOpenCampaign) onOpenCampaign(report.code);
                    else setWizardOpen(true);
                  }}
                  onSelectAll={selectAllEligible}
                />
              </div>
              <ReportActions
                response={response}
                selectedCount={selected.size}
                registeredEmailOnly={registeredEmailOnly}
                exportScope={exportScope}
                isLoadingMore={preview.isPending}
                isExporting={exporting.isPending}
                onLoadMore={() => preview.mutate({ page: response.pagination.page + 1, append: true })}
                onExportScopeChange={setExportScope}
                onExport={() => exporting.mutate()}
                onReset={reset}
              />
              {isWizardOpen && (
                <CampaignWizard
                  open
                  report={report}
                  parameters={parameters}
                  rows={response.items.filter((row) => selected.has(row.patientId))}
                  sender={sender}
                  onClose={() => {
                    if (onCloseCampaign) onCloseCampaign(report.code);
                    else setWizardOpen(false);
                  }}
                  onFinish={() => {
                    setWizardOpen(false);
                    onOpenCampaigns?.();
                  }}
                />
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function SenderNotice({
  sender,
  onOpenSettings
}: {
  sender: SenderConfiguration;
  onOpenSettings: () => void;
}) {
  const verified = sender.domains.find((domain) => domain.status === "VERIFIED");
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
      <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-[13px] font-semibold">Entregabilidad protegida</p>
            <p className="mt-1 text-[12px] leading-5 text-amber-900/80">
              Los envíos usarán{" "}
              <strong>
                {verified ? `${verified.fromLocalPart}@${verified.domain}` : sender.defaultSender.fromAddress}
              </strong>
              .{" "}
              {verified
                ? "Dominio verificado con SPF, DKIM y DMARC."
                : "Configura un dominio propio para alinear tu marca y reducir bloqueos."}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenSettings}>
          Usar dominio personalizado
        </Button>
      </div>
    </div>
  );
}

function ReportLibrary({
  reports,
  activeReport,
  parameters,
  sender,
  branchId,
  isGenerating,
  onChoose,
  onBranchChange,
  onParameterChange,
  onGenerate
}: {
  reports: MarketingReportDefinition[];
  activeReport: MarketingReportDefinition | null;
  parameters: Record<string, unknown>;
  sender: SenderConfiguration;
  branchId: string;
  isGenerating: boolean;
  onChoose: (report: MarketingReportDefinition) => void;
  onBranchChange: (value: string) => void;
  onParameterChange: (key: string, value: unknown) => void;
  onGenerate: (report: MarketingReportDefinition) => void;
}) {
  const categoryCounts = useMemo(
    () =>
      reports.reduce<Record<string, number>>((result, item) => {
        result[item.category] = (result[item.category] ?? 0) + 1;
        return result;
      }, {}),
    [reports]
  );

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden border-0 bg-[var(--text-brand-strong)] text-white hover:translate-y-0">
        <div className="relative z-10 max-w-3xl py-4">
          <span className="inline-flex h-6 items-center rounded-full border border-sky-300/35 bg-sky-400/20 px-3 text-[11px] font-semibold tracking-wider text-sky-100 uppercase backdrop-blur-xs">
            CRM basado en datos
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight">
            Convierte actividad clínica en conversaciones oportunas.
          </h3>
          <p className="mt-3 text-[14px] leading-6 text-white/70">
            Abre un reporte y configura únicamente los filtros que necesita. Cada reporte aplica sus propios
            criterios para construir una lista clara de destinatarios.
          </p>
        </div>
        <UsersRound className="absolute -bottom-12 right-8 h-52 w-52 text-white/[0.05]" />
      </Card>

      <Card className="overflow-hidden p-0 hover:translate-y-0">
        <div className="flex flex-col gap-4 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Generación de reportes
            </p>
            <h3 className="mt-1 font-semibold text-[var(--text-primary)]">
              Selecciona y despliega un reporte
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Cada fila abre su propia lista de criterios; solo puede permanecer una abierta.
            </p>
          </div>
          <div className="w-full lg:w-[320px]">
            {activeReport?.code === TREATED_PATIENTS_REPORT ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] leading-5 text-sky-900">
                <p className="font-semibold">Alcance definido por el profesional</p>
                <p>Se consultarán sus pacientes atendidos en toda la organización.</p>
              </div>
            ) : (
              <Field label="Sucursal">
                <Select
                  aria-label="Sucursal de los reportes"
                  value={branchId}
                  onChange={(event) => onBranchChange(event.target.value)}
                >
                  <option value="">Todas las sucursales autorizadas</option>
                  {sender.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </div>

        <div className="divide-y divide-[var(--border-default)]">
          {reports.map((definition) => {
            const expanded = activeReport?.code === definition.code;
            const specificParameters = [
              ...definition.requiredParameters,
              ...definition.optionalParameters
            ].filter((parameter) => parameter.key !== "branchId");
            const missingRequired = expanded && hasMissingRequiredParameters(definition, parameters);
            return (
              <section
                key={definition.code}
                className={`relative transition-colors ${expanded ? "bg-[var(--bg-brand-light)]/45" : "bg-[var(--bg-surface)]"}`}
              >
                {expanded && <span className="absolute inset-y-0 left-0 w-1 bg-[var(--action-primary)]" />}
                <button
                  type="button"
                  data-allow-multiline
                  aria-expanded={expanded}
                  aria-controls={`marketing-report-${definition.code}`}
                  onClick={() => onChoose(definition)}
                  className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[var(--bg-subtle)]"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{definition.name}</span>
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {definition.category} · {categoryCounts[definition.category]}
                      </span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-5 text-[var(--text-secondary)]">
                      {definition.description}
                    </span>
                  </span>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${expanded ? "rotate-180 border-[var(--border-brand)] bg-[var(--bg-surface)] text-[var(--text-brand)]" : "border-[var(--border-default)] text-[var(--text-secondary)] group-hover:border-[var(--border-brand)] group-hover:text-[var(--text-brand)]"}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>

                {expanded && (
                  <div
                    id={`marketing-report-${definition.code}`}
                    className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-5"
                  >
                    <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                      {specificParameters.map((parameter) => (
                        <ParameterField
                          key={parameter.key}
                          parameter={parameter}
                          value={parameters[parameter.key]}
                          onChange={(value) => onParameterChange(parameter.key, value)}
                          sender={sender}
                        />
                      ))}
                      {!specificParameters.length && (
                        <div className="sm:col-span-2 xl:col-span-3">
                          <div className="flex min-h-10 items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] text-sky-900">
                            <Info className="h-4 w-4 shrink-0" />
                            <span>
                              Este reporte no necesita criterios adicionales. Se aplicará únicamente la
                              sucursal seleccionada arriba.
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-end sm:col-span-2 xl:col-span-1">
                        <Button
                          className="w-full"
                          disabled={Boolean(missingRequired) || isGenerating}
                          onClick={() => onGenerate(definition)}
                        >
                          <FileSearch className="h-4 w-4" />
                          {isGenerating ? "Generando..." : "Generar reporte"}
                        </Button>
                      </div>
                    </div>
                    {missingRequired && (
                      <p className="mt-3 text-[11px] font-medium text-[var(--status-danger-text)]">
                        Completa los campos obligatorios para generar este reporte.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function buildDefaultReportParameters(definition: MarketingReportDefinition, branchId = "") {
  const today = new Date().toISOString().slice(0, 10);
  return [...definition.requiredParameters, ...definition.optionalParameters].reduce<Record<string, unknown>>(
    (result, parameter) => {
      if (parameter.defaultValue !== undefined) result[parameter.key] = parameter.defaultValue;
      if (parameter.type === "date" && !result[parameter.key]) result[parameter.key] = today;
      if (parameter.type === "month" && !result[parameter.key]) result[parameter.key] = today.slice(0, 7);
      if (parameter.type === "boolean" && result[parameter.key] === undefined) result[parameter.key] = false;
      if (parameter.key === "branchId") result[parameter.key] = branchId;
      return result;
    },
    {}
  );
}

export function hasMissingRequiredParameters(
  definition: MarketingReportDefinition,
  parameters: Record<string, unknown>
) {
  return definition.requiredParameters.some((parameter) => {
    const value = parameters[parameter.key];
    return value === undefined || value === null || value === "";
  });
}

function ResultsTable({
  response,
  selected,
  onToggle,
  onSelectPage,
  onClear,
  report
}: {
  response: MarketingReportResponse;
  selected: Set<string>;
  onToggle: (row: MarketingPatientRow) => void;
  onSelectPage: () => void;
  onClear: () => void;
  report: MarketingReportDefinition;
}) {
  const showsClinicalAttention = report.code === "PATIENTS_TREATED_BY_PROFESSIONAL";
  return (
    <Card className="min-w-0 overflow-hidden p-0 hover:translate-y-0">
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">Resultados del reporte</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
            {response.pagination.total} coincidencias · página {response.pagination.page}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onSelectPage}>
            Seleccionar página
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Limpiar
          </Button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table
          className={`w-full text-left text-[12px] ${showsClinicalAttention ? "min-w-[880px]" : "min-w-[1050px]"}`}
        >
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="px-3 py-3 font-medium" title={report.professionalMeaning}>
                Profesional {report.professionalMeaning && <Info className="ml-1 inline h-3 w-3" />}
              </th>
              <th className="px-3 py-3 font-medium">Documento</th>
              <th className="px-3 py-3 font-medium">Paciente</th>
              <th className="px-3 py-3 font-medium">Teléfono</th>
              <th className="px-3 py-3 font-medium">Correo</th>
              <th className="px-3 py-3 font-medium">Sucursal</th>
              <th className="px-3 py-3 font-medium">
                {showsClinicalAttention ? "Última atención" : "Última cita"}
              </th>
              {!showsClinicalAttention && <th className="px-3 py-3 font-medium">Elegibilidad</th>}
            </tr>
          </thead>
          <tbody>
            {response.items.map((row) => {
              const activityDate = showsClinicalAttention ? row.lastAttentionAt : row.lastAppointment;
              return (
                <tr
                  key={row.patientId}
                  className={`border-t border-[var(--border-default)] ${row.eligible || showsClinicalAttention ? "hover:bg-[var(--bg-subtle)]" : "bg-slate-50/70"}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${row.fullName}`}
                      checked={selected.has(row.patientId)}
                      disabled={!row.eligible}
                      onChange={() => onToggle(row)}
                    />
                  </td>
                  <td className="max-w-36 px-3 py-3 text-[var(--text-secondary)]">
                    {row.professional ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px]">{row.documentNumber ?? "—"}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{row.fullName}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                      {row.patientId.slice(0, 10)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{row.phone ?? "Sin teléfono"}</td>
                  <td
                    className="max-w-48 truncate px-3 py-3 text-[var(--text-secondary)]"
                    title={row.email ?? ""}
                  >
                    {row.email ?? "Sin correo"}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{row.branch}</td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">
                    {activityDate ? new Date(activityDate).toLocaleDateString("es-MX") : "—"}
                  </td>
                  {!showsClinicalAttention && (
                    <td className="px-3 py-3">
                      {row.eligible ? (
                        <Badge value="Elegible" tone="success" />
                      ) : (
                        <div className="max-w-52">
                          <Badge value="No elegible" tone="danger" />
                          <p className="mt-1.5 leading-4 text-[var(--status-danger-text)]">
                            {row.eligibilityReasons.map((reason) => reason.label).join(" · ")}
                          </p>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type ExportScope = "ALL" | "ELIGIBLE" | "SELECTED" | "INELIGIBLE";

function ReportActions({
  response,
  selectedCount,
  registeredEmailOnly,
  exportScope,
  isLoadingMore,
  isExporting,
  onLoadMore,
  onExportScopeChange,
  onExport,
  onReset
}: {
  response: MarketingReportResponse;
  selectedCount: number;
  registeredEmailOnly: boolean;
  exportScope: ExportScope;
  isLoadingMore: boolean;
  isExporting: boolean;
  onLoadMore: () => void;
  onExportScopeChange: (scope: ExportScope) => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const remaining = Math.max(0, response.pagination.total - response.items.length);
  return (
    <Card className="overflow-hidden p-0 hover:translate-y-0">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Acciones del reporte
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
              {response.items.length} de {response.pagination.total} resultados cargados · {selectedCount}{" "}
              seleccionados
            </p>
          </div>
          {!remaining && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Reporte completo
            </span>
          )}
        </div>
      </div>
      <div className="grid divide-y divide-[var(--border-default)] lg:grid-cols-[0.9fr_1.35fr_0.9fr] lg:divide-x lg:divide-y-0">
        <div className="flex min-w-0 flex-col justify-between gap-3 p-5">
          <div>
            <p className="font-medium text-[var(--text-primary)]">Ampliar resultados</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Carga la página siguiente sin perder la selección actual.
            </p>
          </div>
          <Button
            variant="secondary"
            className="h-auto min-h-10 w-full whitespace-normal py-2"
            disabled={!remaining || isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isLoadingMore
              ? "Cargando resultados…"
              : remaining
                ? `Cargar ${Math.min(50, remaining)} resultados más`
                : "Todos los resultados cargados"}
          </Button>
        </div>
        <div className="min-w-0 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--bg-brand-light)] p-2 text-[var(--text-brand)]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[var(--text-primary)]">Reporte Excel formal</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                Incluye resumen ejecutivo, parámetros aplicados y detalle auditado de pacientes.
              </p>
            </div>
          </div>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Select
              aria-label="Contenido del reporte Excel"
              value={exportScope}
              onChange={(event) => onExportScopeChange(event.target.value as ExportScope)}
            >
              <option value="ALL">Todos los resultados</option>
              {!registeredEmailOnly && <option value="ELIGIBLE">Solamente elegibles</option>}
              <option value="SELECTED">Solamente seleccionados</option>
              {!registeredEmailOnly && <option value="INELIGIBLE">No elegibles con motivo</option>}
            </Select>
            <Button
              className="h-10 whitespace-nowrap"
              disabled={isExporting || (exportScope === "SELECTED" && !selectedCount)}
              onClick={onExport}
            >
              {isExporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isExporting ? "Preparando…" : "Descargar XLSX"}
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-3 p-5">
          <div>
            <p className="font-medium text-[var(--text-primary)]">Nuevo análisis</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Regresa a la biblioteca. Si hay selección, se solicitará confirmación.
            </p>
          </div>
          <Button variant="ghost" className="h-auto min-h-10 w-full whitespace-normal py-2" onClick={onReset}>
            <RefreshCw className="h-4 w-4" />
            Generar un nuevo reporte
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SelectionPanel({
  response,
  selectedCount,
  registeredEmailOnly,
  selectingAll,
  onCreate,
  onSelectAll
}: {
  response: MarketingReportResponse;
  selectedCount: number;
  registeredEmailOnly: boolean;
  selectingAll: boolean;
  onCreate: () => void;
  onSelectAll: () => void;
}) {
  const noEligiblePatients =
    !registeredEmailOnly && response.pagination.total > 0 && response.summary.eligible === 0;
  return (
    <Card className="min-w-0 overflow-hidden p-0 hover:translate-y-0 2xl:sticky 2xl:top-4">
      <div className="bg-[var(--text-brand-strong)] px-5 py-5 text-white">
        <div className="flex min-w-0 items-center gap-2 text-white/70">
          <Send className="h-4 w-4 shrink-0" />
          <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em]">Nueva campaña</span>
        </div>
        <p className="mt-5 text-4xl font-semibold tabular-nums">{selectedCount}</p>
        <p className="mt-1 text-[13px] text-white/65">pacientes seleccionados</p>
      </div>
      <div className="min-w-0 space-y-4 p-5">
        <p className="text-[13px] leading-5 text-[var(--text-secondary)]">
          {registeredEmailOnly
            ? "Selecciona los pacientes atendidos por el profesional que recibirán la campaña."
            : "Selecciona pacientes elegibles para preparar una campaña segura."}
        </p>
        <div className="min-w-0 space-y-2 rounded-lg bg-[var(--bg-subtle)] p-3 text-[12px]">
          <SummaryLine label="Resultados" value={response.pagination.total} />
          {!registeredEmailOnly && (
            <SummaryLine label="Elegibles visibles" value={response.summary.eligible} />
          )}
          <SummaryLine label="Seleccionados" value={selectedCount} strong />
          {!registeredEmailOnly && (
            <SummaryLine label="No elegibles visibles" value={response.summary.ineligible} />
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-auto min-h-10 w-full whitespace-normal px-3 py-2 text-center leading-5"
          disabled={selectingAll}
          onClick={onSelectAll}
        >
          {selectingAll ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {selectingAll
            ? registeredEmailOnly
              ? "Cargando pacientes…"
              : "Revisando elegibilidad…"
            : registeredEmailOnly
              ? "Seleccionar todos los pacientes"
              : "Seleccionar todos los elegibles"}
        </Button>
        {noEligiblePatients && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-900">
            <p className="font-semibold">No hay destinatarios seleccionables en esta página.</p>
            <p className="mt-1">
              Al pulsar el botón se revisará el reporte completo y se informarán los motivos de exclusión.
            </p>
          </div>
        )}
        <Button
          className="h-auto min-h-10 w-full whitespace-normal px-3 py-2 text-center leading-5"
          disabled={selectedCount === 0}
          onClick={onCreate}
        >
          <span className="min-w-0">Crear una nueva campaña</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
        <div className="flex min-w-0 gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-[11px] leading-4 text-sky-900">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            {registeredEmailOnly
              ? "Antes de guardar o enviar, el backend confirma la relación clínica con el profesional y que el correo siga registrado."
              : "Antes de guardar o enviar, el backend revalida bajas, rebotes, consentimiento, sucursal y duplicados."}
          </span>
        </div>
      </div>
    </Card>
  );
}

function CampaignWizard({
  open,
  onClose,
  onFinish,
  report,
  parameters,
  rows,
  sender
}: {
  open: boolean;
  onClose: () => void;
  onFinish: () => void;
  report: MarketingReportDefinition;
  parameters: Record<string, unknown>;
  rows: MarketingPatientRow[];
  sender: SenderConfiguration;
}) {
  const client = useQueryClient();
  const templates = useQuery({
    queryKey: ["email-marketing", "templates"],
    queryFn: listTemplates,
    enabled: open
  });
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [recipientRows, setRecipientRows] = useState(rows);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const registeredEmailOnly = report.code === TREATED_PATIENTS_REPORT;
  const [form, setForm] = useState({
    name: `Campaña ${report.name}`,
    subject: "",
    preheader: "",
    templateId: "",
    contentHtml:
      "<h1>Hola {{patient.firstName}}</h1>\n<p>Tenemos novedades de {{organization.name}} para ti.</p>",
    contentText: "Hola {{patient.firstName}}, tenemos novedades de {{organization.name}} para ti.",
    fromName: sender.organization.name,
    replyTo: sender.organization.email ?? "",
    tags: ""
  });
  const create = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      setCampaignId(campaign.id);
      setStep(4);
      toast.success("Borrador creado", {
        description: `${recipientRows.length} destinatarios congelados y listos para revisión.`
      });
      void client.invalidateQueries({ queryKey: ["email-marketing", "campaigns"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const test = useMutation({
    mutationFn: () => sendCampaignTest(campaignId!, testEmail),
    onSuccess: () =>
      toast.success("Correo de prueba enviado", {
        description: "La prueba no afecta las métricas ni el historial del paciente."
      }),
    onError: (error: Error) => toast.error(error.message)
  });
  const send = useMutation({
    mutationFn: () => sendCampaignNow(campaignId!),
    onSuccess: () => {
      toast.success("Campaña encolada", {
        description: "El worker revalidará destinatarios antes de cada envío."
      });
      void client.invalidateQueries({ queryKey: ["email-marketing", "campaigns"] });
      onFinish();
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const schedule = useMutation({
    mutationFn: () => scheduleCampaign(campaignId!, new Date(scheduledAt).toISOString()),
    onSuccess: () => {
      toast.success("Campaña programada");
      void client.invalidateQueries({ queryKey: ["email-marketing", "campaigns"] });
      onFinish();
    },
    onError: (error: Error) => toast.error(error.message)
  });
  const activeTemplate = (templates.data ?? []).find((template) => template.id === form.templateId);
  const activeBranch = sender.branches.find((branch) => branch.id === parameters.branchId);
  const fromAddress = sender.domains.find((domain) => domain.status === "VERIFIED");
  const filteredRecipients = recipientRows.filter((row) =>
    `${row.fullName} ${row.email ?? ""}`.toLowerCase().includes(recipientSearch.trim().toLowerCase())
  );
  const replyToIsValid = !form.replyTo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.replyTo);
  const previewHtml = form.contentHtml
    .replaceAll("{{patient.firstName}}", "Paciente")
    .replaceAll("{{patient.lastName}}", "Ejemplo")
    .replaceAll("{{branch.name}}", activeBranch?.name ?? "Tu sucursal")
    .replaceAll("{{organization.name}}", sender.organization.name)
    .replaceAll("{{unsubscribeUrl}}", "#cancelar-suscripcion");
  const chooseTemplate = (id: string) => {
    const template = (templates.data ?? []).find((item) => item.id === id);
    setForm((current) =>
      template
        ? {
            ...current,
            templateId: id,
            subject: template.subject,
            preheader: template.preheader ?? "",
            contentHtml: template.html,
            contentText: template.text
          }
        : { ...current, templateId: "" }
    );
  };
  const createDraft = () =>
    create.mutate({
      name: form.name.trim(),
      subject: form.subject.trim(),
      preheader: form.preheader.trim() || undefined,
      fromName: form.fromName.trim() || undefined,
      replyTo: form.replyTo.trim() || undefined,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      reportCode: report.code,
      parameters,
      patientIds: recipientRows.map((row) => row.patientId),
      branchId:
        typeof parameters.branchId === "string" && parameters.branchId ? parameters.branchId : undefined,
      templateId: form.templateId || undefined,
      contentHtml: form.contentHtml,
      contentText: form.contentText,
      idempotencyKey: crypto.randomUUID()
    });

  return (
    <Modal open={open} title="Crear campaña de Marketing" onClose={onClose} size="xl">
      <div className="mb-6 grid grid-cols-5 gap-1">
        {["Información", "Destinatarios", "Contenido", "Vista previa", "Envío"].map((label, index) => (
          <div key={label} className="text-center">
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${step >= index + 1 ? "bg-[var(--action-primary)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}
            >
              {step > index + 1 ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <p className="mt-1 hidden text-[10px] font-medium text-[var(--text-secondary)] sm:block">
              {label}
            </p>
          </div>
        ))}
      </div>
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] leading-5 text-sky-900">
            <strong>
              {recipientRows.length}{" "}
              {registeredEmailOnly ? "pacientes con correo." : "destinatarios elegibles."}
            </strong>{" "}
            Primero define identidad y asunto de la campaña; el borrador se guardará después de revisar
            contenido.
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Nombre interno *">
              <Input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Organización">
              <Input disabled value={sender.organization.name} />
            </Field>
            <Field label="Sucursal">
              <Input
                disabled
                value={
                  activeBranch?.name ??
                  (registeredEmailOnly ? "Sucursales del profesional" : "Todas las autorizadas")
                }
              />
            </Field>
            <Field label="Asunto *">
              <Input
                required
                maxLength={180}
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </Field>
            <Field label="Preheader">
              <Input
                maxLength={180}
                value={form.preheader}
                onChange={(event) => setForm({ ...form, preheader: event.target.value })}
              />
            </Field>
            <Field label="Nombre del remitente">
              <Input
                maxLength={160}
                value={form.fromName}
                onChange={(event) => setForm({ ...form, fromName: event.target.value })}
              />
            </Field>
            <Field label="Correo de respuesta">
              <Input
                type="email"
                value={form.replyTo}
                onChange={(event) => setForm({ ...form, replyTo: event.target.value })}
              />
            </Field>
            <Field label="Cuenta de envío">
              <Input
                disabled
                value={
                  fromAddress
                    ? `${fromAddress.fromLocalPart}@${fromAddress.domain}`
                    : sender.defaultSender.fromAddress
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Etiquetas internas">
                <Input
                  placeholder="reactivación, julio, pacientes TET"
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                />
              </Field>
            </div>
          </div>
          {!replyToIsValid && (
            <p className="text-[11px] font-medium text-[var(--status-danger-text)]">
              Ingresa un correo de respuesta válido.
            </p>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <WizardMetric label="Reporte" value={report.name} />
            <WizardMetric label="Seleccionados" value={String(rows.length)} />
            <WizardMetric label="Destinatarios" value={String(recipientRows.length)} />
            <WizardMetric label="Retirados" value={String(rows.length - recipientRows.length)} />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
            <Input
              className="pl-9"
              value={recipientSearch}
              placeholder="Buscar destinatario por nombre o correo"
              onChange={(event) => setRecipientSearch(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border-default)]">
            {filteredRecipients.map((row) => (
              <div
                key={row.patientId}
                className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 text-[13px] last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text-primary)]">{row.fullName}</p>
                  <p className="truncate text-[12px] text-[var(--text-secondary)]">{row.email}</p>
                </div>
                <Button
                  aria-label={`Retirar ${row.fullName}`}
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    setRecipientRows((current) => current.filter((item) => item.patientId !== row.patientId))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Retirar
                </Button>
              </div>
            ))}
            {!filteredRecipients.length && (
              <p className="px-4 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                No hay destinatarios que coincidan con la búsqueda.
              </p>
            )}
          </div>
          {!recipientRows.length && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
              La campaña necesita al menos un paciente con correo.
            </div>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <Field label="Usar plantilla">
            <Select value={form.templateId} onChange={(event) => chooseTemplate(event.target.value)}>
              <option value="">Crear mensaje desde cero</option>
              {(templates.data ?? [])
                .filter((template) => template.status === "ACTIVE")
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · v{template.version}
                  </option>
                ))}
            </Select>
          </Field>
          {activeTemplate && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
              Plantilla <strong>{activeTemplate.category}</strong> seleccionada. La campaña guardará una copia
              independiente de esta versión.
            </div>
          )}
          <Field label="HTML seguro *">
            <Textarea
              className="min-h-52 font-mono text-[12px]"
              value={form.contentHtml}
              onChange={(event) => setForm({ ...form, contentHtml: event.target.value })}
            />
          </Field>
          <Field label="Texto alternativo *">
            <Textarea
              value={form.contentText}
              onChange={(event) => setForm({ ...form, contentText: event.target.value })}
            />
          </Field>
          <p className="break-words text-[11px] leading-5 text-[var(--text-secondary)]">
            Variables disponibles:{" "}
            {
              "{{patient.firstName}} · {{patient.lastName}} · {{branch.name}} · {{organization.name}} · {{unsubscribeUrl}}"
            }
            . El backend elimina JavaScript y agrega el enlace de baja obligatorio.
          </p>
        </div>
      )}
      {step === 4 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2">
              <p className="min-w-0 truncate text-[11px] font-medium text-[var(--text-secondary)]">
                VISTA PREVIA · {form.subject}
              </p>
              <div className="flex rounded-lg border border-[var(--border-default)] bg-white p-0.5">
                <button
                  type="button"
                  aria-pressed={previewMode === "desktop"}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${previewMode === "desktop" ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)]" : "text-[var(--text-secondary)]"}`}
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Escritorio
                </button>
                <button
                  type="button"
                  aria-pressed={previewMode === "mobile"}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${previewMode === "mobile" ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)]" : "text-[var(--text-secondary)]"}`}
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Móvil
                </button>
              </div>
            </div>
            <div className="min-h-72 bg-slate-100 p-5">
              <iframe
                title="Vista previa segura de la campaña"
                sandbox=""
                referrerPolicy="no-referrer"
                className={`mx-auto min-h-72 w-full rounded-lg bg-white shadow-sm transition-[max-width] ${previewMode === "mobile" ? "max-w-[360px]" : "max-w-2xl"}`}
                srcDoc={previewHtml}
              />
            </div>
          </div>
          <Card className="h-fit bg-[var(--bg-subtle)] hover:translate-y-0">
            <MailCheck className="h-6 w-6 text-[var(--text-brand)]" />
            <p className="mt-3 font-medium text-[var(--text-primary)]">Prueba controlada</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Confirma asunto, variables, enlaces y remitente. Esta prueba no cuenta como contacto al
              paciente.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                aria-label="Correo para prueba"
                type="email"
                placeholder="correo@ejemplo.com"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
              />
              <Button
                variant="secondary"
                className="w-full"
                disabled={!testEmail || test.isPending}
                onClick={() => test.mutate()}
              >
                {test.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="h-4 w-4" />
                )}
                {test.isPending ? "Enviando…" : "Enviar mail de prueba"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {step === 5 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col hover:translate-y-0">
            <Save className="h-6 w-6 text-[var(--text-brand)]" />
            <h4 className="mt-3 font-semibold text-[var(--text-primary)]">Guardar borrador</h4>
            <p className="mt-2 flex-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Conserva destinatarios y contenido y abre su registro en Campañas de Marketing.
            </p>
            <Button
              variant="ghost"
              className="mt-5 w-full"
              onClick={() => {
                toast.success("Borrador guardado");
                onFinish();
              }}
            >
              Guardar y salir
            </Button>
          </Card>
          <Card className="flex flex-col hover:translate-y-0">
            <Send className="h-6 w-6 text-[var(--text-brand)]" />
            <h4 className="mt-3 font-semibold text-[var(--text-primary)]">Enviar ahora</h4>
            <p className="mt-2 flex-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Revalida destinatarios y coloca el trabajo en la cola; la petición HTTP no envía correos
              directamente.
            </p>
            <Button className="mt-5 w-full" disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {send.isPending ? "Encolando…" : "Enviar campaña"}
            </Button>
          </Card>
          <Card className="flex flex-col hover:translate-y-0">
            <RefreshCw className="h-6 w-6 text-[var(--text-brand)]" />
            <h4 className="mt-3 font-semibold text-[var(--text-primary)]">Programar</h4>
            <p className="mt-2 text-[13px] leading-5 text-[var(--text-secondary)]">
              El worker respetará ventana horaria, límites e idempotencia.
            </p>
            <Input
              className="mt-4"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <Button
              variant="secondary"
              className="mt-3 w-full"
              disabled={!scheduledAt || schedule.isPending}
              onClick={() => schedule.mutate()}
            >
              {schedule.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {schedule.isPending ? "Programando…" : "Programar campaña"}
            </Button>
          </Card>
        </div>
      )}
      {step < 5 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4">
          <Button
            variant="ghost"
            disabled={step === 1 || Boolean(campaignId)}
            onClick={() => setStep((value) => Math.max(1, value - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </Button>
          {step === 1 && (
            <Button
              disabled={!form.name.trim() || !form.subject.trim() || !replyToIsValid}
              onClick={() => setStep(2)}
            >
              Revisar destinatarios
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button disabled={!recipientRows.length} onClick={() => setStep(3)}>
              Preparar contenido
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button
              disabled={
                create.isPending ||
                !recipientRows.length ||
                !form.contentHtml.trim() ||
                !form.contentText.trim()
              }
              onClick={createDraft}
            >
              {create.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {create.isPending ? "Guardando borrador…" : "Crear borrador y revisar"}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => setStep(5)}>
              Continuar a envío
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

function ParameterField({
  parameter,
  value,
  onChange,
  sender
}: {
  parameter: ReportParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  sender: SenderConfiguration;
}) {
  if (parameter.type === "branch")
    return (
      <Field label={`${parameter.label}${parameter.required ? " *" : ""}`}>
        <Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Todas las autorizadas</option>
          {sender.branches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  if (parameter.type === "professional")
    return (
      <Field label={`${parameter.label}${parameter.required ? " *" : ""}`}>
        <Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">
            {parameter.required
              ? "Selecciona un profesional"
              : (parameter.placeholder ?? "Todos los profesionales")}
          </option>
          {sender.professionals.map((item) => (
            <option key={item.id} value={item.id}>
              {item.firstName} {item.lastName}
            </option>
          ))}
        </Select>
      </Field>
    );
  if (parameter.type === "agreement")
    return (
      <Field label={`${parameter.label}${parameter.required ? " *" : ""}`}>
        <Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecciona un convenio</option>
          {sender.agreements.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  if (parameter.options?.length)
    return (
      <Field label={`${parameter.label}${parameter.required ? " *" : ""}`}>
        <Select
          value={String(value ?? "")}
          onChange={(event) =>
            onChange(parameter.type === "number" ? Number(event.target.value) : event.target.value)
          }
        >
          {!parameter.required && <option value="">{parameter.placeholder ?? "Todos"}</option>}
          {parameter.options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  if (parameter.type === "boolean")
    return (
      <label className="mt-6 flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-[13px]">
        <input
          className="shrink-0"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="min-w-0 break-words">{parameter.label}</span>
      </label>
    );
  return (
    <Field label={`${parameter.label}${parameter.required ? " *" : ""}`}>
      <Input
        required={parameter.required}
        type={parameter.type === "number" ? "number" : parameter.type}
        min={parameter.type === "number" ? 1 : undefined}
        value={String(value ?? "")}
        onChange={(event) =>
          onChange(parameter.type === "number" ? Number(event.target.value) : event.target.value)
        }
      />
    </Field>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-start justify-between gap-3 ${strong ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
function WizardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-subtle)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block min-w-0 break-words text-[12px] font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
function deduplicateRows(rows: MarketingPatientRow[]) {
  return [...new Map(rows.map((row) => [row.patientId, row])).values()];
}

async function fetchAllReportRows(
  code: string,
  parameters: Record<string, unknown>,
  total: number,
  search: string
) {
  const pageSize = 100;
  const pageCount = Math.ceil(total / pageSize);
  const rows: MarketingPatientRow[] = [];
  const concurrency = 5;
  for (let startPage = 1; startPage <= pageCount; startPage += concurrency) {
    const pages = Array.from(
      { length: Math.min(concurrency, pageCount - startPage + 1) },
      (_, index) => startPage + index
    );
    const responses = await Promise.all(
      pages.map((page) =>
        previewMarketingReport(code, { parameters, page, pageSize, search: search || undefined })
      )
    );
    rows.push(...responses.flatMap((response) => response.items));
  }
  return deduplicateRows(rows);
}

function summarizeEligibilityBlocks(rows: MarketingPatientRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const reason of row.eligibilityReasons) {
      counts.set(reason.label, (counts.get(reason.label) ?? 0) + 1);
    }
  }
  const summary = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
  return summary || "Revisa correo, estado y consentimiento de marketing de los pacientes.";
}
