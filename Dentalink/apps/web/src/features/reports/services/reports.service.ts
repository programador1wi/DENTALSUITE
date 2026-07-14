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
};

export type ExcelReportRequest = {
  id: string;
  type?: ExcelReportType;
  reportCode: string;
  reportName: string;
  category: string;
  format: "csv" | "xlsx";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED";
  requestedBy?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  parameters?: Record<string, unknown>;
  filters: ReportEnvelope<unknown>["filters"];
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
};

export type GeneratedChartReport = {
  title: string;
  description: string;
  filters: PerformanceDashboard["filters"];
  definitions: Record<string, unknown>;
  summary: Record<string, number | string>;
  chart: Array<Record<string, number | string>>;
  rows: Array<Record<string, number | string | null>>;
};

export async function getPerformanceReport(params?: AnalyticsFilters) {
  const { data } = await http.get<PerformanceDashboard>("/reports/performance", { params });
  return data;
}

export async function getChartsCatalog() {
  const { data } = await http.get<ChartCatalogItem[]>("/reports/charts/catalog");
  return data;
}

export async function generateChartReport(type: string, payload: AnalyticsFilters & { criteria?: string }) {
  const { data } = await http.post<GeneratedChartReport>(`/reports/charts/${type}/generate`, payload);
  return data;
}

export async function getExcelCatalog() {
  const { data } = await http.get<ExcelCatalogItem[]>("/reports/excel/catalog");
  return data;
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
