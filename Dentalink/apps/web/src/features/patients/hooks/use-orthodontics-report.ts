import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { orthodonticsService, OrthodonticReportFilters } from "../services/orthodontics.service";

export function useOrthodonticPatientsReport(filters: OrthodonticReportFilters) {
  return useQuery({
    queryKey: ["orthodontics", "patients-report", filters],
    queryFn: () => orthodonticsService.getPatientsReport(filters),
    placeholderData: keepPreviousData,
  });
}

export function useOrthodonticReportSummary(branchId?: string) {
  return useQuery({
    queryKey: ["orthodontics", "patients-report-summary", branchId],
    queryFn: () => orthodonticsService.getReportSummary(branchId),
  });
}

export function useDraftOrthodonticAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ treatmentId, payload }: { treatmentId: string, payload: any }) => 
      orthodonticsService.draftAppointment(treatmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orthodontics"] });
    },
  });
}

export function useRecalculateOrthodonticProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (treatmentId: string) => orthodonticsService.recalculateProgress(treatmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orthodontics"] });
    },
  });
}
