import { http } from "@/lib/api/http-client";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  format?: "json" | "csv" | "xlsx";
};

export type ReportEnvelope<T> = {
  filters: { dateFrom: string; dateTo: string; branchId?: string };
  data: T;
  export?: {
    format: "csv" | "xlsx";
    fileName: string;
    mimeType: string;
    base64: string;
  };
};

export type AnalyticsFilters = ReportFilters & {
  preset?: "month" | "last30" | "custom";
  month?: string;
  year?: string;
  currency?: string;
  criteria?: string;
  limit?: number;
  search?: string;
  professionalId?: string;
  specialtyId?: string;
  page?: number;
  pageSize?: number;
};

export type ExcelReportType = "appointments" | "patients" | "treatments" | "financial" | "professionals" | string;

export type ReportParameterType =
  | "text"
  | "select"
  | "multiselect"
  | "date"
  | "dateRange"
  | "month"
  | "year"
  | "number"
  | "checkbox"
  | "branch"
  | "priceList"
  | "professional"
  | "patient"
  | "appointmentStatus"
  | "paymentMethod"
  | "warehouse"
  | "inventoryWarehouse"
  | "laboratory"
  | "agreement"
  | "treatmentCategory";

export type ReportParameterDefinition = {
  key: string;
  label: string;
  type: ReportParameterType;
  required?: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{ label: string; value: string }>;
  dependsOn?: string;
  maxRangeDays?: number;
};

export type ExcelCatalogItem = {
  id: string;
  code: string;
  name: string;
  type: ExcelReportType;
  title: string;
  category: string;
  description: string;
  permission: string;
  supportedFormats: Array<"csv" | "xlsx">;
  parameters: ReportParameterDefinition[];
  handler: string | null;
  estimatedComplexity?: "LOW" | "MEDIUM" | "HIGH";
  enabled: boolean;
  country?: string;
  plan?: string;
  keywords?: string[];
  filters: string[];
  lastRunAt: string | null;
  surfaces?: Array<"REQUEST" | "PERIOD">;
  temporalMode?: "RANGE" | "MONTH" | "AS_OF" | "CURRENT";
  dateField?: string | null;
  requiredPermissions?: string[];
};

export type ExcelReportRequest = {
  id: string;
  type?: ExcelReportType;
  reportCode: string;
  reportName: string;
  category: string;
  format: "csv" | "xlsx";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  requestedBy?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  parameters?: Record<string, unknown>;
  filters?: ReportEnvelope<unknown>["filters"];
  file: ReportEnvelope<unknown>["export"] | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  rowCount?: number | null;
  errorMessage: string | null;
};

export type ExcelReportRequestPayload = {
  reportCode: string;
  format: "csv" | "xlsx";
  parameters: Record<string, unknown>;
  idempotencyKey?: string;
  surface?: "REQUEST" | "PERIOD";
};

export type PerformanceDashboard = {
  filters: {
    dateFrom: string;
    dateTo: string;
    branchId: string | null;
    branchName: string;
    branchIds: string[];
    timezone: string;
    currency: string;
    preset: string;
    periodMode: "automatic" | "historical";
    asOf: string;
  };
  updatedAt: string;
  definitions: Record<string, unknown>;
  agenda: {
    newPatients: number;
    cancelledAppointments: number;
    occupancy: { usedMinutes: number; availableMinutes: number; percent: number };
    diagnosticBudgets: number;
    attendedVsScheduled: { attended: number; scheduled: number; percent: number };
    monthlyAttention: Array<{ month: string; attended: number }>;
  };
  finance: {
    sales: number;
    collections: number;
    previousSales: number;
    previousCollections: number;
    salesVariationPercent: number;
    collectionsVariationPercent: number;
    monthly: Array<{ month: string; sales: number; collections: number }>;
  };
  operation: {
    averageWaitMinutes: number;
    historicalAverageWaitMinutes: number;
    variationPercent: number;
    samples: number;
  };
  production: {
    theoreticalCosts: number;
    salesByProfessional: Array<{ professionalId: string; name: string; sales: number; attendedHours: number; efficiency: number }>;
    professionalEfficiency: Array<{ professionalId: string; name: string; sales: number; attendedHours: number; efficiency: number }>;
  };
};

export type ChartCatalogItem = {
  type: string;
  title: string;
  description: string;
  renderer: ChartReportRenderer;
  destination?: string;
};

export type ChartReportRenderer = "chart-table" | "table" | "matrix" | "stacked-cohort" | "redirect" | "captured-budgets";

export type GeneratedChartReport = {
  schemaVersion: 2;
  type: string;
  renderer: ChartReportRenderer;
  title: string;
  description: string;
  filters: PerformanceDashboard["filters"];
  definitions: Record<string, unknown>;
  summary: Record<string, number | string>;
  chart: Array<Record<string, unknown>>;
  rows: Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
  exportCode?: string;
};

export async function getPerformanceReport(params?: AnalyticsFilters) {
  const { data } = await http.get<PerformanceDashboard>("/reports/performance", { params });
  return data;
}

export async function getChartsCatalog() {
  const { data } = await http.get<ChartCatalogItem[]>("/reports/charts/catalog");
  return data;
}

export async function generateChartReport(type: string, payload: AnalyticsFilters) {
  const { data } = await http.post<GeneratedChartReport>(`/reports/charts/${type}/generate`, payload);
  return data;
}

export async function getExcelCatalog(surface?: "REQUEST" | "PERIOD") {
  const { data } = await http.get<ExcelCatalogItem[]>("/reports/excel/catalog", { params: surface ? { surface } : undefined });
  return data;
}

export type ExcelRequestsPage = {
  rows: ExcelReportRequest[];
  total: number;
  page: number;
  pageSize: number;
};

export type PriceListReportOption = {
  id: string;
  code: string;
  name: string;
  currency: string;
  versionNumber: number;
};

export async function getExcelReportRequests(params?: { status?: string; category?: string; search?: string; page?: number; pageSize?: number }) {
  const { data } = await http.get<ExcelRequestsPage>("/reports/excel/requests", { params });
  return data;
}

export async function getPriceListReportOptions(branchId: string) {
  const { data } = await http.get<PriceListReportOption[]>("/reports/excel/options/price-lists", {
    params: { branchId }
  });
  return data;
}

export async function downloadStoredExcelReport(id: string, fileName?: string | null) {
  const { data, headers } = await http.get<Blob>(`/reports/excel/requests/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || extractDownloadName(headers["content-disposition"]) || "reporte.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function extractDownloadName(header?: string) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return encoded ? decodeURIComponent(encoded) : undefined;
}

export async function createExcelReportRequest(payload: ExcelReportRequestPayload | (ReportFilters & { type: ExcelReportType; search?: string; category?: string })) {
  const { data } = await http.post<ExcelReportRequest>("/reports/excel/requests", payload);
  return data;
}

export async function getDashboardReport(params?: ReportFilters) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/dashboard", { params });
  return data;
}

export async function getAppointmentsReport(params?: ReportFilters) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/appointments", { params });
  return data;
}

export async function getPatientsReport(params?: ReportFilters) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/patients", { params });
  return data;
}

export async function getTreatmentsReport(params?: ReportFilters) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/treatments", { params });
  return data;
}

export async function getFinancialReport(params?: ReportFilters) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/financial", { params });
  return data;
}

export async function getProfessionalsReport(params?: ReportFilters & { professionalId?: string }) {
  const { data } = await http.get<ReportEnvelope<unknown>>("/reports/professionals", { params });
  return data;
}

export function downloadReportExport(payload?: ReportEnvelope<unknown>["export"]) {
  if (!payload) return;
  const bytes = atob(payload.base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    buffer[i] = bytes.charCodeAt(i);
  }
  const blob = new Blob([buffer], { type: payload.mimeType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
