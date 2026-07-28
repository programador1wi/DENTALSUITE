import { http } from "@/lib/api/http-client";

export interface OrthodonticProgressSnapshot {
  calculatedAt: string;
  plannedControls: number | null;
  expectedControls: number | null;
  completedControls: number;
  calendarProgress: number | null;
  realProgress: number | null;
  progressDifference: number | null;
  progressStatus: "DELAYED" | "ON_TRACK" | "AHEAD" | "NOT_CALCULABLE";
  hasFutureAppointment: boolean;
  lastEvolutionAt: string | null;
  suggestedAppointmentAt: string | null;
  scheduledAppointmentAt: string | null;
}

export interface OrthodonticPatientRow {
  id: string;
  treatmentId: string;
  treatmentPlanId: string;
  treatmentName: string;
  patientId: string;
  patientName: string;
  patientLastName: string;
  patientGender: string;
  patientAge: number;
  patientPhone: string | null;
  patientMobile: string | null;
  startDate: string | null;
  professionalName: string;
  progress: OrthodonticProgressSnapshot;
  calendarProgress?: any;
  controlProgress?: any;
  progressDifference?: any;
  lastEvolution?: any;
  nextControl?: any;
}

export interface OrthodonticReportSummary {
  activePatients: number;
  delayedPatients: number;
  withoutFutureAppointment: number;
  age1to6: number;
  age6to12: number;
  ageOver12: number;
  missingBirthDate: number;
}

export interface OrthodonticReportFilters {
  branchId?: string;
  page?: number;
  limit?: number;
  search?: string;
  delayStatus?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const orthodonticsService = {
  async getPatientsReport(filters: OrthodonticReportFilters) {
    const { data } = await http.get<{
      data: OrthodonticPatientRow[];
      meta: { total: number; page: number; lastPage: number };
    }>("/orthodontics/patients-report", { params: filters });
    return data;
  },

  async getReportSummary(branchId?: string) {
    const { data } = await http.get<OrthodonticReportSummary>("/orthodontics/patients-report/summary", {
      params: { branchId },
    });
    return data;
  },

  async draftAppointment(treatmentId: string, payload: { professionalId: string; branchId: string; startAt: string }) {
    const { data } = await http.post<{ appointmentId: string }>(
      `/orthodontics/treatments/${treatmentId}/appointment-draft`,
      payload
    );
    return data;
  },

  async recalculateProgress(treatmentId: string) {
    const { data } = await http.post(
      `/orthodontics/treatments/${treatmentId}/recalculate-progress`
    );
    return data;
  }
};
