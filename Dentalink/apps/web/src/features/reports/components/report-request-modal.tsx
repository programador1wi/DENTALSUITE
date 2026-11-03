import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { requestExcelReport, usePriceListReportOptions } from "../hooks/use-reports";
import type { ExcelCatalogItem, ExcelReportRequest, ReportParameterDefinition } from "../services/reports.service";

type ParameterValue = string | string[] | boolean | number;

type ReportRequestModalProps = {
  reportId: string | null;
  reports: ExcelCatalogItem[];
  open: boolean;
  onClose: () => void;
  onRequested: (request: ExcelReportRequest) => void;
  lastRequest?: ExcelReportRequest | null;
  requestCount?: number;
};

function buildDefaults(report: ExcelCatalogItem | null) {
  const defaults: Record<string, ParameterValue> = {};
  for (const parameter of report?.parameters ?? []) {
    if (parameter.defaultValue !== undefined) defaults[parameter.key] = parameter.defaultValue as ParameterValue;
    else if (parameter.type === "checkbox") defaults[parameter.key] = false;
    else if (parameter.type === "appointmentStatus" || parameter.type === "multiselect") defaults[parameter.key] = [];
    else defaults[parameter.key] = "";
  }
  return defaults;
}

function relativeTime(value?: string) {
  if (!value) return "Sin solicitudes previas";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} dias`;
}

function parseYmd(dateStr: string): string {
  if (!dateStr) return "-";
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  ATTENDED: "Atendida",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
  PENDING: "Pendiente",
  PROCESSING: "Procesando",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  EXPIRED: "Expirado",
  ALL: "Todos",
  ENABLED: "Habilitados",
  DISABLED: "Deshabilitados"
};

function translateValue(val: unknown): string {
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (typeof val === "string") return STATUS_LABELS[val] ?? val;
  if (Array.isArray(val)) return val.map((v) => STATUS_LABELS[String(v)] ?? String(v)).join(", ");
  return String(val ?? "-");
}

function formatParameterSummary(
  parameters?: Record<string, unknown>,
  branchMap?: Map<string, string>,
  profMap?: Map<string, string>,
  pmMap?: Map<string, string>
) {
  if (!parameters || !Object.keys(parameters).length) return "Sin parametros";
  const items: string[] = [];

  const dateFrom = parameters.dateFrom ? String(parameters.dateFrom) : null;
  const dateTo = parameters.dateTo ? String(parameters.dateTo) : null;
  if (dateFrom && dateTo) {
    const fromFmt = parseYmd(dateFrom);
    const toFmt = parseYmd(dateTo);
    items.push(`Periodo: ${fromFmt === toFmt ? fromFmt : `${fromFmt} - ${toFmt}`}`);
  } else if (dateFrom) {
    items.push(`Desde: ${parseYmd(dateFrom)}`);
  } else if (dateTo) {
    items.push(`Hasta: ${parseYmd(dateTo)}`);
  }

  if (parameters.branchId) {
    const name = String(parameters.branchName ?? branchMap?.get(String(parameters.branchId)) ?? "Sucursal seleccionada");
    items.push(`Sucursal: ${name}`);
  } else if (Array.isArray(parameters.branchIds) && parameters.branchIds.length > 0) {
    const names = (parameters.branchIds as string[])
      .map((id) => branchMap?.get(id))
      .filter((n): n is string => Boolean(n));
    items.push(`Sucursales: ${names.length > 0 ? names.join(", ") : `${parameters.branchIds.length} sucursales`}`);
  }

  if (parameters.professionalId) {
    const name = profMap?.get(String(parameters.professionalId)) ?? "Profesional asignado";
    items.push(`Profesional: ${name}`);
  }

  if (parameters.paymentMethodId) {
    const name = pmMap?.get(String(parameters.paymentMethodId)) ?? "Medio de pago";
    items.push(`Medio de pago: ${name}`);
  }

  if (parameters.priceListId) {
    items.push(`Arancel: ${String(parameters.priceListName ?? "Arancel seleccionado")}`);
  }

  const handledKeys = new Set([
    "dateFrom",
    "dateTo",
    "branchId",
    "branchIds",
    "branchName",
    "professionalId",
    "paymentMethodId",
    "priceListId",
    "priceListName",
    "priceListCode",
    "priceListVersionId",
    "priceListVersionNumber",
    "priceListCurrency"
  ]);
  for (const [key, value] of Object.entries(parameters)) {
    if (handledKeys.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    let keyLabel = key;
    if (key === "status" || key === "statuses") keyLabel = "Estado";
    else if (key === "cashRegisterId") keyLabel = "Caja";

    const valStr = String(value);
    if (typeof value === "string" && valStr.length > 20 && !valStr.includes(" ")) continue;

    items.push(`${keyLabel}: ${translateValue(value)}`);
  }

  return items.length ? items.join(" | ") : "Sin parametros";
}

function isDateRangeInvalid(values: Record<string, ParameterValue>) {
  const from = values.dateFrom ? new Date(String(values.dateFrom)) : null;
  const to = values.dateTo ? new Date(String(values.dateTo)) : null;
  return Boolean(from && to && from > to);
}

export function ReportRequestModal({ reportId, reports, open, onClose, onRequested, lastRequest, requestCount = 0 }: ReportRequestModalProps) {
  const report = useMemo(() => reports.find((item) => item.id === reportId || item.code === reportId) ?? null, [reportId, reports]);
  const [values, setValues] = useState<Record<string, ParameterValue>>({});
  const [submittingFormat, setSubmittingFormat] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const selectedBranchId = typeof values.branchId === "string" ? values.branchId : "";
  const needsPriceList = Boolean(report?.parameters.some((parameter) => parameter.type === "priceList"));
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { branchId: selectedBranchId || undefined, pageSize: 100 });
  const paymentMethods = usePaymentMethods(undefined, "true");
  const priceLists = usePriceListReportOptions(selectedBranchId, open && needsPriceList);

  const branchMap = useMemo(() => new Map((branches.data ?? []).map((b) => [b.id, b.name])), [branches.data]);
  const profMap = useMemo(() => new Map((professionals.data ?? []).map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()])), [professionals.data]);
  const pmMap = useMemo(() => new Map((paymentMethods.data ?? []).map((m) => [m.id, m.name])), [paymentMethods.data]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setValues(buildDefaults(report));
    setError("");
    setSuccess("");
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input, select, button")?.focus(), 0);

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open, report]);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(buildDefaults(report)), [report, values]);

  function closeModal() {
    if (dirty && !success && !window.confirm("Hay parametros modificados. Deseas cerrar el modal?")) return;
    onClose();
  }

  function updateValue(parameter: ReportParameterDefinition, value: ParameterValue) {
    setValues((current) => {
      const next = { ...current, [parameter.key]: value };
      for (const child of report?.parameters ?? []) {
        if (child.dependsOn === parameter.key) {
          next[child.key] = child.type === "multiselect" || child.type === "appointmentStatus" ? [] : "";
        }
      }
      return next;
    });
  }

  function validate() {
    if (!report) return "Reporte no encontrado";
    if (!report.enabled) return report.unavailableReason ?? "El generador del reporte no está disponible.";
    if (needsPriceList && priceLists.isError) return "No fue posible cargar los aranceles vigentes.";
    for (const parameter of report.parameters) {
      const value = values[parameter.key];
      const missing = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
      if (parameter.required && missing) return "Selecciona los campos obligatorios.";
    }
    if (isDateRangeInvalid(values)) return "El rango de fechas no es valido.";
    const maxRange = report.parameters.find((parameter) => parameter.key === "dateFrom" || parameter.key === "dateTo")?.maxRangeDays;
    if (maxRange && values.dateFrom && values.dateTo) {
      const from = new Date(String(values.dateFrom));
      const to = new Date(String(values.dateTo));
      const days = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
      if (days > maxRange) return `El rango maximo permitido es de ${maxRange} dias.`;
    }
    return "";
  }

  async function submit(format: "csv" | "xlsx") {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    if (!report) return;
    setSubmittingFormat(format);
    setError("");
    setSuccess("");
    try {
      const result = await requestExcelReport({
        reportCode: report.code,
        format,
        parameters: values,
        idempotencyKey: `${report.code}-${format}-${Date.now()}`,
        surface: "REQUEST"
      });
      onRequested(result);
      setSuccess("Solicitud creada. Puedes seguir su avance en Historial de solicitudes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible generar el reporte.");
    } finally {
      setSubmittingFormat(null);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter(
      (element) => !element.hasAttribute("disabled")
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderParameter(parameter: ReportParameterDefinition) {
    const value = values[parameter.key];
    const common = {
      id: `report-param-${parameter.key}`,
      "aria-label": parameter.label
    };

    if (parameter.type === "branch") {
      const branchOptions = branches.data ?? [];
      return (
        <div className="space-y-1.5">
          <Select
            {...common}
            value={String(value ?? "")}
            onChange={(event) => updateValue(parameter, event.target.value)}
            disabled={branches.isLoading || branches.isError || branchOptions.length === 0}
            dropdownClassName="max-h-[320px]"
          >
            {parameter.required ? <option value="" disabled>Selecciona sucursal</option> : <option value="">Todas las sucursales autorizadas</option>}
            {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
          {branches.isLoading ? <p className="text-[12px] text-[var(--text-muted)]">Cargando sucursales autorizadas...</p> : null}
          {branches.isError ? <p className="text-[12px] text-[var(--text-danger)]">No fue posible cargar sucursales.</p> : null}
          {!branches.isLoading && !branches.isError && !branchOptions.length ? <p className="text-[12px] text-[var(--text-muted)]">No hay sucursales autorizadas disponibles.</p> : null}
        </div>
      );
    }

    if (parameter.type === "priceList") {
      const options = priceLists.data ?? [];
      return (
        <div className="space-y-1.5">
          <Select
            {...common}
            value={String(value ?? "")}
            onChange={(event) => updateValue(parameter, event.target.value)}
            disabled={!selectedBranchId || priceLists.isLoading || priceLists.isError || options.length === 0}
            dropdownClassName="max-h-[320px]"
          >
            <option value="" disabled>
              {!selectedBranchId ? "Selecciona primero una sucursal" : "Selecciona arancel"}
            </option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · v{option.versionNumber} · {option.currency}
              </option>
            ))}
          </Select>
          {selectedBranchId && priceLists.isLoading ? <p className="text-[12px] text-[var(--text-muted)]">Cargando aranceles vigentes...</p> : null}
          {selectedBranchId && priceLists.isError ? <p className="text-[12px] text-[var(--text-danger)]">No fue posible cargar los aranceles vigentes.</p> : null}
          {selectedBranchId && !priceLists.isLoading && !priceLists.isError && options.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">No hay aranceles vigentes con tratamientos activos para esta sucursal.</p>
          ) : null}
        </div>
      );
    }

    if (parameter.type === "professional") {
      return (
        <Select {...common} value={String(value ?? "")} onChange={(event) => updateValue(parameter, event.target.value)} disabled={professionals.isLoading}>
          <option value="">{selectedBranchId ? "Todos los profesionales" : "Selecciona sucursal para filtrar"}</option>
          {professionals.data?.map((professional) => (
            <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
          ))}
        </Select>
      );
    }

    if (parameter.type === "paymentMethod") {
      return (
        <Select {...common} value={String(value ?? "")} onChange={(event) => updateValue(parameter, event.target.value)} disabled={paymentMethods.isLoading}>
          <option value="">Todos los medios de pago</option>
          {paymentMethods.data?.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
        </Select>
      );
    }

    if (parameter.type === "appointmentStatus" || parameter.type === "multiselect") {
      const selected = Array.isArray(value) ? value : [];
      return (
        <Select
          {...common}
          multiple
          value={selected}
          onChange={(event) => updateValue(parameter, Array.from(event.target.selectedOptions).map((option) => option.value))}
          className="min-h-[96px]"
        >
          {parameter.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      );
    }

    if (parameter.type === "select" && parameter.options?.length) {
      return (
        <Select {...common} value={String(value ?? "")} onChange={(event) => updateValue(parameter, event.target.value)}>
          {!parameter.required ? <option value="">Todos</option> : null}
          {parameter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      );
    }

    if (parameter.type === "checkbox") {
      return (
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(parameter, event.target.checked)} />
          {parameter.label}
        </label>
      );
    }

    const inputType = parameter.type === "date" ? "date" : parameter.type === "month" ? "month" : parameter.type === "year" || parameter.type === "number" ? "number" : "text";
    return <Input {...common} type={inputType} value={String(value ?? "")} onChange={(event) => updateValue(parameter, event.target.value)} placeholder={parameter.type === "select" ? "ID o criterio" : undefined} />;
  }

  return (
    <Modal open={open} title={report ? `Solicitar generacion de reporte de ${report.name}` : "Solicitar reporte"} onClose={closeModal} size="xl">
      <div ref={dialogRef} role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown} className="space-y-5">
        {report ? (
          <>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-[620px]">
                  <p className="text-[14px] leading-6 text-[var(--text-secondary)]">{report.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge value={report.category} tone="brand" />
                    <Badge value={report.enabled ? "Disponible" : "No disponible"} tone={report.enabled ? "success" : "warning"} />
                    <Badge value={`Solicitado ${requestCount} veces`} tone="default" />
                  </div>
                </div>
                <FileSpreadsheet className="h-6 w-6 text-[var(--text-brand)]" />
              </div>
            </div>

            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] p-4 md:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ultima solicitud</p>
                <p className="mt-1 text-[14px] text-[var(--text-primary)]">{relativeTime(lastRequest?.requestedAt)}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Parametros usados</p>
                <p className="mt-1 break-words text-[13px] text-[var(--text-secondary)]">{formatParameterSummary(lastRequest?.parameters, branchMap, profMap, pmMap)}</p>
              </div>
            </div>

            <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
              {report.parameters.map((parameter) => (
                <div key={parameter.key} className="grid gap-2">
                  <label htmlFor={`report-param-${parameter.key}`} className="text-[13px] font-medium text-[var(--text-primary)]">
                    {parameter.label}{parameter.required ? " *" : ""}
                  </label>
                  {renderParameter(parameter)}
                  {parameter.dependsOn ? (
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {parameter.type === "priceList"
                        ? "La sucursal determina los aranceles disponibles. Al cambiarla se limpia el arancel seleccionado."
                        : `Depende de ${parameter.dependsOn}. Al cambiarlo se limpian valores incompatibles.`}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {error ? <ErrorState message={error} /> : null}
            {success ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(16,185,129,0.32)] bg-[rgba(16,185,129,0.08)] p-3 text-[13px] text-[var(--text-success)]">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            ) : null}
            {!report.enabled ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[rgba(251,191,36,0.34)] p-3 text-[13px] text-[var(--text-warning)]">
                <AlertTriangle className="h-4 w-4" />
                {report.unavailableReason ?? "Este reporte permanece deshabilitado hasta validar su fuente y contenido."}
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <Button type="button" variant="secondary" onClick={closeModal}>Cerrar</Button>
              {report.supportedFormats.includes("csv") ? (
                <Button type="button" variant="secondary" onClick={() => submit("csv")} disabled={!report.enabled || submittingFormat !== null || (needsPriceList && priceLists.isFetching)}>
                  {submittingFormat === "csv" ? "Solicitando..." : "Solicitar archivo CSV"}
                </Button>
              ) : null}
              {report.supportedFormats.includes("xlsx") ? (
                <Button type="button" onClick={() => submit("xlsx")} disabled={!report.enabled || submittingFormat !== null || (needsPriceList && priceLists.isFetching)}>
                  {submittingFormat === "xlsx" ? "Generando solicitud..." : "Solicitar archivo XLSX"}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
