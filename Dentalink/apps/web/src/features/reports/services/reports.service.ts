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
