import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Handshake,
  Search,
  Tags,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tabs } from "@/components/ui/tabs";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { ReportRequestModal } from "../components/report-request-modal";
import { useExcelCatalog, useExcelRequests } from "../hooks/use-reports";
import { downloadStoredExcelReport, type ExcelCatalogItem, type ExcelReportRequest } from "../services/reports.service";

const PAGE_SIZE = 10;

const CATEGORY_ITEMS = [
  { key: "", label: "Todas", icon: FileSpreadsheet },
  { key: "AGENDA", label: "Agenda", icon: CalendarDays },
  { key: "LISTADO DE PRECIOS", label: "Listado de precios", icon: Tags },
  { key: "CONVENIOS", label: "Convenios", icon: Handshake },
  { key: "CRM", label: "CRM", icon: ClipboardList },
  { key: "FINANZAS", label: "Finanzas", icon: WalletCards },
  { key: "INVENTARIO", label: "Inventario", icon: Boxes },
  { key: "LABORATORIOS", label: "Laboratorios", icon: FlaskConical },
  { key: "NOMINAS", label: "Nominas", icon: ClipboardList },
  { key: "PACIENTES", label: "Pacientes", icon: UsersRound },
  { key: "TRATAMIENTOS", label: "Tratamientos", icon: ClipboardList },
  { key: "USUARIOS", label: "Usuarios", icon: UserRound }
];

function useDebouncedValue(value: string, delayMs = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function statusTone(status: ExcelReportRequest["status"]) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "EXPIRED") return "danger";
  if (status === "PENDING" || status === "PROCESSING") return "warning";
  return "default";
}

function displayCategory(category: string) {
  return CATEGORY_ITEMS.find((item) => item.key === category)?.label ?? category;
}

function relativeTime(value?: string) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} dias`;
}

function isDownloadable(request?: ExcelReportRequest | null) {
  if (!request?.id || request.status !== "COMPLETED" || !request.fileName) return false;
  if (!request.expiresAt) return true;
  return new Date(request.expiresAt).getTime() > Date.now();
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

function formatFullDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${hours}:${mins}`;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
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

function RenderParameterChips({
  parameters,
  branchMap,
  profMap,
  pmMap
}: {
  parameters?: Record<string, unknown>;
  branchMap: Map<string, string>;
  profMap: Map<string, string>;
  pmMap: Map<string, string>;
}) {
  if (!parameters || !Object.keys(parameters).length) {
    return <span className="text-[12px] text-[var(--text-muted)]">-</span>;
  }

  const chips: Array<{ label: string; value: string }> = [];

  const dateFrom = parameters.dateFrom ? String(parameters.dateFrom) : null;
  const dateTo = parameters.dateTo ? String(parameters.dateTo) : null;
  if (dateFrom && dateTo) {
    const fromFmt = parseYmd(dateFrom);
    const toFmt = parseYmd(dateTo);
    chips.push({
      label: "Período",
      value: fromFmt === toFmt ? fromFmt : `${fromFmt} - ${toFmt}`
    });
  } else if (dateFrom) {
    chips.push({ label: "Desde", value: parseYmd(dateFrom) });
  } else if (dateTo) {
    chips.push({ label: "Hasta", value: parseYmd(dateTo) });
  }

  if (parameters.branchId) {
    const name = String(parameters.branchName ?? branchMap.get(String(parameters.branchId)) ?? "Sucursal seleccionada");
    chips.push({ label: "Sucursal", value: name });
  } else if (Array.isArray(parameters.branchIds) && parameters.branchIds.length > 0) {
    const names = (parameters.branchIds as string[])
      .map((id) => branchMap.get(id))
      .filter((n): n is string => Boolean(n));
    chips.push({
      label: "Sucursales",
      value: names.length > 0 ? names.join(", ") : `${parameters.branchIds.length} sucursales`
    });
  }

  if (parameters.professionalId) {
    const name = profMap.get(String(parameters.professionalId)) ?? "Profesional asignado";
    chips.push({ label: "Profesional", value: name });
  }

  if (parameters.paymentMethodId) {
    const name = pmMap.get(String(parameters.paymentMethodId)) ?? "Medio de pago";
    chips.push({ label: "Medio de pago", value: name });
  }

  if (parameters.priceListId) {
    chips.push({ label: "Arancel", value: String(parameters.priceListName ?? "Arancel seleccionado") });
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
    if (typeof value === "string" && valStr.length > 20 && !valStr.includes(" ")) {
      continue;
    }

    chips.push({ label: keyLabel, value: translateValue(value) });
  }

  if (!chips.length) {
    return <span className="text-[12px] text-[var(--text-muted)]">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 py-0.5">
      {chips.map((chip, idx) => (
        <span
          key={`${chip.label}-${idx}`}
          className="inline-flex max-w-[280px] items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-normal text-[var(--text-secondary)]"
        >
          <strong className="font-semibold text-[var(--text-primary)]">{chip.label}:</strong>
          <span className="truncate">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function matchesCatalogSearch(item: ExcelCatalogItem, needle: string) {
  if (!needle) return true;
  return `${item.name} ${item.title} ${item.description} ${item.category} ${(item.keywords ?? []).join(" ")}`.toLowerCase().includes(needle);
}

export function ReportsExcelPage() {
  const [tab, setTab] = useState("request");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyCategory, setHistoryCategory] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const catalog = useExcelCatalog();
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { pageSize: 100 });
  const paymentMethods = usePaymentMethods(undefined, "true");

  const branchMap = useMemo(() => new Map((branches.data ?? []).map((b) => [b.id, b.name])), [branches.data]);
  const profMap = useMemo(() => new Map((professionals.data ?? []).map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()])), [professionals.data]);
  const pmMap = useMemo(() => new Map((paymentMethods.data ?? []).map((m) => [m.id, m.name])), [paymentMethods.data]);

  const historyQuery = useExcelRequests({
    search: historySearch || undefined,
    category: historyCategory || undefined,
    status: historyStatus || undefined,
    page: historyPage,
    pageSize: PAGE_SIZE
  });
  const reports = catalog.data ?? [];
  const history = historyQuery.data?.rows ?? [];
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of reports) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, [reports]);

  const filteredCatalog = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return reports.filter((item) => {
      const matchesCategory = !category || item.category === category;
      return matchesCategory && matchesCatalogSearch(item, needle);
    });
  }, [reports, category, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil((historyQuery.data?.total ?? 0) / PAGE_SIZE));
  const selectedReport = reports.find((report) => report.id === selectedReportId || report.code === selectedReportId) ?? null;

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyCategory, historyStatus]);

  function lastRequestFor(report: ExcelCatalogItem) {
    return history.find((request) => request.reportCode === report.code);
  }

  function completedRequestFor(report: ExcelCatalogItem) {
    return history.find((request) => request.reportCode === report.code && isDownloadable(request));
  }

  function openReport(report: ExcelCatalogItem) {
    setSelectedReportId(report.id);
  }

  function handleReportKeyDown(event: KeyboardEvent<HTMLDivElement>, report: ExcelCatalogItem) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openReport(report);
    }
  }

  function handleLastDownload(event: MouseEvent<HTMLButtonElement>, request: ExcelReportRequest) {
    event.stopPropagation();
    void downloadStoredExcelReport(request.id, request.fileName);
  }

  function handleRequested(_request: ExcelReportRequest) {
    setSelectedReportId(null);
    void historyQuery.refetch();
    setTab("history");
  }

  if (catalog.isLoading) return <LoadingState message="Cargando catalogo de reportes Excel..." />;
  if (catalog.isError) return <ErrorState message={catalog.error.message} />;

  return (
    <Card className="mx-auto max-w-[1180px] overflow-hidden p-0">
      <div className="border-b border-[var(--border-default)] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold leading-tight text-[var(--text-primary)]">Reportes</h1>
              <p className="text-[13px] text-[var(--text-secondary)]">Solicita reportes autorizados y descarga archivos generados de forma segura.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Tabs
              active={tab}
              onChange={setTab}
              items={[
                { key: "request", label: "Solicitar reportes" },
                { key: "history", label: "Historial de solicitudes" }
              ]}
            />
            {tab === "request" ? (
              <div className="relative w-full md:w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar reporte" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {tab === "request" ? (
        <div className="grid min-h-[520px] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 lg:border-b-0 lg:border-r">
            <nav aria-label="Categorias de reportes" className="max-h-[64vh] space-y-1 overflow-y-auto pr-1">
              {CATEGORY_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = category === item.key;
                const count = item.key ? categoryCounts.get(item.key) ?? 0 : reports.length;
                return (
                  <button
                    key={item.key || "ALL"}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setCategory(item.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] transition ${
                      active
                        ? "border-[var(--border-brand)] bg-[var(--bg-surface)] text-[var(--text-brand)] shadow-sm"
                        : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--text-brand)]" : "text-[var(--text-muted)]"}`} />
                      <span className="truncate font-medium">{item.label}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">{count}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{category ? displayCategory(category) : "Todas las categorias"}</p>
                <p className="text-[12px] text-[var(--text-secondary)]">{filteredCatalog.length} reportes disponibles en esta vista</p>
              </div>
            </div>

            <div className="max-h-[64vh] overflow-y-auto">
              {filteredCatalog.length ? (
                <div className="divide-y divide-[var(--border-default)]">
                  {filteredCatalog.map((item) => {
                    const last = lastRequestFor(item);
                    const completed = completedRequestFor(item);
                    return (
                      <div
                        key={item.code}
                        role="button"
                        data-allow-multiline
                        tabIndex={0}
                        aria-label={`Solicitar generacion de reporte de ${item.name}`}
                        onClick={() => openReport(item)}
                        onKeyDown={(event) => handleReportKeyDown(event, item)}
                        className="group flex cursor-pointer items-center gap-3 px-4 py-3 outline-none transition hover:bg-[var(--bg-subtle)] focus-visible:bg-[var(--bg-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                      >
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-brand)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{item.name}</h2>
                            <Badge value={displayCategory(item.category)} tone="brand" />
                            {!item.enabled ? <Badge value="Sin generador" tone="warning" /> : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-secondary)]">{item.description}</p>
                        </div>
                        <div className="hidden min-w-[210px] justify-end md:flex">
                          {completed ? (
                            <Button type="button" size="sm" variant="ghost" onClick={(event) => handleLastDownload(event, completed)} aria-label={`Descargar ultimo reporte de ${item.name}`}>
                              <Download className="h-3.5 w-3.5" />
                              Descargar ultimo reporte de {relativeTime(completed.completedAt ?? completed.requestedAt)}
                            </Button>
                          ) : (
                            <span className="text-right text-[12px] text-[var(--text-muted)]">
                              {last ? `${STATUS_LABELS[last.status] ?? last.status} ${relativeTime(last.requestedAt)}` : "Sin ejecuciones"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center p-6">
                  <EmptyState title="No se encontraron reportes." description="Ajusta la busqueda o selecciona otra categoria." />
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
            <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Buscar historial" />
            <Select value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}>
              <option value="">Todas las categorías</option>
              {CATEGORY_ITEMS.filter((item) => item.key).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </Select>
            <Select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}>
              <option value="">Todos los estados</option>
              {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"].map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] ?? status}
                </option>
              ))}
            </Select>
          </div>

          {historyQuery.isError ? <ErrorState message={historyQuery.error.message} /> : null}
          <DataTable
            rows={history as unknown as Record<string, unknown>[]}
            empty={<EmptyState title="Sin solicitudes" description="Solicita un reporte para ver su historial aqui." />}
            responsiveCards
            columns={[
              {
                key: "reportName",
                title: "Reporte",
                wrap: true,
                render: (row) => (
                  <div className="min-w-0 py-0.5">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {String(row.reportName ?? row.type ?? "-")}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                      {displayCategory(String(row.category ?? ""))}
                    </p>
                  </div>
                )
              },
              {
                key: "parameters",
                title: "Parametros",
                wrap: true,
                render: (row) => (
                  <RenderParameterChips
                    parameters={row.parameters as Record<string, unknown> | undefined}
                    branchMap={branchMap}
                    profMap={profMap}
                    pmMap={pmMap}
                  />
                )
              },
              {
                key: "requestedAt",
                title: "Solicitado",
                render: (row) => (
                  <div className="min-w-0 py-0.5">
                    <p className="text-[12px] font-medium text-[var(--text-primary)]">
                      {formatFullDateTime(String(row.requestedAt))}
                    </p>
                    <p className="mt-0.5 max-w-[170px] truncate text-[11px] text-[var(--text-muted)]" title={String(row.requestedBy ?? "")}>
                      Por: {String(row.requestedBy ?? "-")}
                    </p>
                  </div>
                )
              },
              {
                key: "status",
                title: "Estado",
                render: (row) => (
                  <div className="py-0.5">
                    <Badge
                      value={STATUS_LABELS[String(row.status)] ?? String(row.status)}
                      tone={statusTone(String(row.status) as ExcelReportRequest["status"])}
                    />
                    {row.rowCount != null && Number(row.rowCount) > 0 ? (
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{Number(row.rowCount)} registros</p>
                    ) : null}
                  </div>
                )
              },
              {
                key: "expiresAt",
                title: "Expira",
                render: (row) => (
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    {row.expiresAt ? formatDateOnly(String(row.expiresAt)) : "-"}
                  </span>
                )
              },
              {
                key: "file",
                title: "Descarga",
                render: (row) => {
                  const request = row as unknown as ExcelReportRequest;
                  const fileSizeLabel = request.fileSize ? ` (${Math.round(Number(request.fileSize) / 1024)} KB)` : "";
                  return isDownloadable(request) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void downloadStoredExcelReport(request.id, request.fileName)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar{fileSizeLabel}
                    </Button>
                  ) : (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {String(request.errorMessage ?? (request.status === "PENDING" || request.status === "PROCESSING" ? "Procesando..." : "-"))}
                    </span>
                  );
                }
              }
            ]}
          />

          <TablePagination
            page={historyPage}
            totalPages={totalPages}
            totalItems={historyQuery.data?.total ?? 0}
            itemLabel="solicitudes"
            onPageChange={setHistoryPage}
          />
        </div>
      )}

      <ReportRequestModal
        reportId={selectedReportId}
        reports={reports}
        open={Boolean(selectedReportId)}
        onClose={() => setSelectedReportId(null)}
        onRequested={handleRequested}
        lastRequest={selectedReport ? lastRequestFor(selectedReport) : null}
        requestCount={selectedReport ? history.filter((request) => request.reportCode === selectedReport.code).length : 0}
      />
    </Card>
  );
}
