import { useQuery } from "@tanstack/react-query";
import {
  createExcelReportRequest,
  generateChartReport,
  getAppointmentsReport,
  getChartsCatalog,
  getDashboardReport,
  getExcelCatalog,
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

export function useExcelCatalog() {
  return useQuery({
    queryKey: ["reports", "excel", "catalog"],
    queryFn: getExcelCatalog
  });
}

export function requestExcelReport(payload: ExcelReportRequestPayload | (ReportFilters & { type: ExcelReportType; search?: string; category?: string })) {
  return createExcelReportRequest(payload);
}

export function requestChartReport(type: string, payload: AnalyticsFilters & { criteria?: string }) {
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
