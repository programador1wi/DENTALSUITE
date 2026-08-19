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
import { ReportRequestModal } from "../components/report-request-modal";
import { useExcelCatalog } from "../hooks/use-reports";
import { downloadReportExport, type ExcelCatalogItem, type ExcelReportRequest } from "../services/reports.service";

const STORAGE_KEY = "dentalwarner.report-excel-history";
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
  if (status === "FAILED" || status === "EXPIRED" || status === "CANCELLED") return "danger";
  if (status === "PENDING" || status === "PROCESSING") return "warning";
  return "default";
}

function displayCategory(category: string) {
  return CATEGORY_ITEMS.find((item) => item.key === category)?.label ?? category;
}

function normalizeStoredRequest(raw: Partial<ExcelReportRequest> & { type?: string }): ExcelReportRequest {
  return {
    id: raw.id ?? `stored-${Date.now()}`,
    type: raw.type,
    reportCode: raw.reportCode ?? String(raw.type ?? "UNKNOWN").toUpperCase(),
    reportName: raw.reportName ?? String(raw.type ?? "Reporte"),
    category: raw.category ?? "Sin categoria",
    format: raw.format ?? raw.file?.format ?? "xlsx",
    status: raw.status ?? "COMPLETED",
    requestedAt: raw.requestedAt ?? new Date().toISOString(),
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    expiresAt: raw.expiresAt,
    parameters: raw.parameters,
    filters: raw.filters ?? { dateFrom: "", dateTo: "" },
    file: raw.file ?? null,
    fileName: raw.fileName ?? raw.file?.fileName ?? null,
    mimeType: raw.mimeType ?? raw.file?.mimeType ?? null,
    fileSize: raw.fileSize ?? null,
    rowCount: raw.rowCount ?? null,
    errorMessage: raw.errorMessage ?? null
  };
}

function loadHistory(): ExcelReportRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeStoredRequest) : [];
  } catch {
    return [];
  }
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
  if (!request?.file || request.status !== "COMPLETED") return false;
  if (!request.expiresAt) return true;
  return new Date(request.expiresAt).getTime() > Date.now();
}

function parameterSummary(parameters?: Record<string, unknown>) {
  if (!parameters || !Object.keys(parameters).length) return "-";
  return Object.entries(parameters)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" | ");
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
  const [historyFormat, setHistoryFormat] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<ExcelReportRequest[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const catalog = useExcelCatalog();
  const reports = catalog.data ?? [];
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

  const filteredHistory = useMemo(() => {
    const needle = historySearch.trim().toLowerCase();
    return history.filter((request) => {
      const requestedAt = new Date(request.requestedAt).getTime();
      const from = historyFrom ? new Date(historyFrom).setHours(0, 0, 0, 0) : null;
      const to = historyTo ? new Date(historyTo).setHours(23, 59, 59, 999) : null;
      const text = `${request.reportName} ${request.reportCode} ${request.category} ${parameterSummary(request.parameters)}`.toLowerCase();
      return (
        (!needle || text.includes(needle)) &&
        (!historyCategory || request.category === historyCategory) &&
        (!historyStatus || request.status === historyStatus) &&
        (!historyFormat || request.format === historyFormat) &&
        (!from || requestedAt >= from) &&
        (!to || requestedAt <= to)
      );
    });
  }, [history, historyCategory, historyFormat, historyFrom, historySearch, historyStatus, historyTo]);

  const paginatedHistory = filteredHistory.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const selectedReport = reports.find((report) => report.id === selectedReportId || report.code === selectedReportId) ?? null;

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  }, [history]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyCategory, historyStatus, historyFormat, historyFrom, historyTo]);

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
    downloadReportExport(request.file ?? undefined);
  }

  function handleRequested(request: ExcelReportRequest) {
    setHistory((current) => [request, ...current.filter((item) => item.id !== request.id)]);
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
              <p className="text-[13px] text-[var(--text-secondary)]">Solicita archivos CSV o XLSX desde el catalogo autorizado.</p>
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
                              {last ? `${last.status} ${relativeTime(last.requestedAt)}` : "Sin ejecuciones"}
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
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_140px_160px_160px]">
            <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Buscar historial" />
            <Select value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}>
              <option value="">Todas</option>
              {CATEGORY_ITEMS.filter((item) => item.key).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </Select>
            <Select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}>
              <option value="">Estados</option>
              {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
            <Select value={historyFormat} onChange={(event) => setHistoryFormat(event.target.value)}>
              <option value="">Formatos</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </Select>
            <Input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} aria-label="Fecha inicial historial" />
            <Input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} aria-label="Fecha final historial" />
          </div>

          <DataTable
            rows={paginatedHistory as unknown as Record<string, unknown>[]}
            empty={<EmptyState title="Sin solicitudes" description="Solicita un reporte para ver su historial aqui." />}
            responsiveCards
            columns={[
              { key: "reportName", title: "Reporte", render: (row) => String(row.reportName ?? row.type ?? "-") },
              { key: "category", title: "Categoria", render: (row) => displayCategory(String(row.category ?? "")) },
              { key: "format", title: "Formato", render: (row) => String(row.format ?? "-").toUpperCase() },
              { key: "parameters", title: "Parametros", render: (row) => <span className="text-[12px]">{parameterSummary(row.parameters as Record<string, unknown> | undefined)}</span>, wrap: true },
              { key: "status", title: "Estado", render: (row) => <Badge value={String(row.status)} tone={statusTone(String(row.status) as ExcelReportRequest["status"])} /> },
              { key: "requestedAt", title: "Solicitado", render: (row) => new Date(String(row.requestedAt)).toLocaleString() },
              { key: "fileSize", title: "Tamano", render: (row) => row.fileSize ? `${Math.round(Number(row.fileSize) / 1024)} KB` : "-" },
              { key: "expiresAt", title: "Expira", render: (row) => row.expiresAt ? new Date(String(row.expiresAt)).toLocaleDateString() : "-" },
              {
                key: "file",
                title: "Descarga",
                render: (row) => {
                  const request = row as unknown as ExcelReportRequest;
                  return isDownloadable(request) ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => downloadReportExport(request.file ?? undefined)}>
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </Button>
                  ) : String(request.errorMessage ?? "-");
                }
              }
            ]}
          />

          <TablePagination
            page={historyPage}
            totalPages={totalPages}
            totalItems={filteredHistory.length}
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
