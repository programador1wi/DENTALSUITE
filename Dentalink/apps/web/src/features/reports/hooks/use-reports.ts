import { useQuery } from "@tanstack/react-query";
import {
  getAppointmentsReport,
  getDashboardReport,
  getFinancialReport,
  getPatientsReport,
  getProfessionalsReport,
  getTreatmentsReport,
  type ReportFilters
} from "../services/reports.service";

export function useDashboardReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "dashboard", filters],
    queryFn: () => getDashboardReport(filters)
  });
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
