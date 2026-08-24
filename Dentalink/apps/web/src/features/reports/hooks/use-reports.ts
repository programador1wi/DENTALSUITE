import { useQuery } from "@tanstack/react-query";
import {
  createExcelReportRequest,
  generateChartReport,
  getAppointmentsReport,
  getChartsCatalog,
  getDashboardReport,
  getExcelCatalog,
  getExcelReportRequests,
  getPriceListReportOptions,
  getFinancialReport,
  getPerformanceReport,
  getPatientsReport,
  getProfessionalsReport,
  getTreatmentsReport,
  type AnalyticsFilters,
  type ExcelReportRequestPayload,
  type ExcelReportType,
  type ReportFilters
} from "../services/reports.service";

export function useDashboardReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "dashboard", filters],
    queryFn: () => getDashboardReport(filters)
  });
}

export function usePerformanceReport(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["reports", "performance", filters],
    queryFn: () => getPerformanceReport(filters)
  });
}

export function useChartsCatalog() {
  return useQuery({
    queryKey: ["reports", "charts", "catalog"],
    queryFn: getChartsCatalog
  });
}

export function useExcelCatalog(surface?: "REQUEST" | "PERIOD") {
  return useQuery({
    queryKey: ["reports", "excel", "catalog", surface],
    queryFn: () => getExcelCatalog(surface)
  });
}

export function useExcelRequests(params?: { status?: string; category?: string; search?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ["reports", "excel", "requests", params],
    queryFn: () => getExcelReportRequests(params),
    refetchInterval: (query) => query.state.data?.rows.some((row) => row.status === "PENDING" || row.status === "PROCESSING") ? 2500 : false
  });
}

export function usePriceListReportOptions(branchId: string, enabled = true) {
  return useQuery({
    queryKey: ["reports", "excel", "options", "price-lists", branchId],
    queryFn: () => getPriceListReportOptions(branchId),
    enabled: enabled && Boolean(branchId)
  });
}

export function requestExcelReport(payload: ExcelReportRequestPayload | (ReportFilters & { type: ExcelReportType; search?: string; category?: string })) {
  return createExcelReportRequest(payload);
}

export function requestChartReport(type: string, payload: AnalyticsFilters) {
  return generateChartReport(type, payload);
}

export function useAppointmentsReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "appointments", filters],
    queryFn: () => getAppointmentsReport(filters)
  });
}

export function usePatientsReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "patients", filters],
    queryFn: () => getPatientsReport(filters)
  });
}

export function useTreatmentsReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "treatments", filters],
    queryFn: () => getTreatmentsReport(filters)
  });
}

export function useFinancialReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "financial", filters],
    queryFn: () => getFinancialReport(filters)
  });
}

export function useProfessionalsReport(filters?: ReportFilters & { professionalId?: string }) {
  return useQuery({
    queryKey: ["reports", "professionals", filters],
    queryFn: () => getProfessionalsReport(filters)
  });
}
