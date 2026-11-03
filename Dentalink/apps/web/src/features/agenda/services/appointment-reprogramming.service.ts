import { http } from "@/lib/api/http-client";
import type { AppointmentStatus, AttendanceMode, AvailabilitySlot } from "./appointments.service";

export type ReprogrammingCaseStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "RESCHEDULED"
  | "DEFINITIVELY_CANCELLED"
  | "EXCLUDED";

export type ReprogrammingCriteria = {
  branchId: string;
  professionalId: string;
  startDate: string;
  endDate: string;
  reasonCode: string;
  reasonText: string;
  observation?: string;
};

export type ReprogrammingPreviewAppointment = {
  id: string;
  patient: { id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null } | null;
  branch: { id: string; name: string; timezone?: string | null };
  professional: { id: string; firstName: string; lastName: string };
  chair?: { id: string; name: string } | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  attentionReason: string;
  warnings: string[];
};

export type ReprogrammingPreview = {
  criteria: ReprogrammingCriteria & { timezone: string; rangeStartAt: string; rangeEndAt: string };
  total: number;
  appointments: ReprogrammingPreviewAppointment[];
};

export type ReprogrammingBatch = {
  id: string;
  status: "CREATED" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  selectedCount: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  excludedCount: number;
  branch: { id: string; name: string };
  professional: { id: string; firstName: string; lastName: string };
  reasonText: string;
  items: Array<{
    id: string;
    status: "PENDING" | "PROCESSED" | "SKIPPED" | "FAILED" | "EXCLUDED";
    errorCode?: string | null;
    errorMessage?: string | null;
    appointment: {
      id: string;
      startAt: string;
      endAt: string;
      patient?: { id: string; firstName: string; lastName: string } | null;
    };
    case?: { id: string; status: ReprogrammingCaseStatus } | null;
  }>;
};

export type ReprogrammingCase = {
  id: string;
  branchId: string;
  originalAppointmentId: string;
  newAppointmentId?: string | null;
  patientId: string;
  originalProfessionalId: string;
  reasonCode: string;
  reasonText: string;
  status: ReprogrammingCaseStatus;
  originalStartAt: string;
  originalEndAt: string;
  originalDurationMinutes: number;
  originalBoxId?: string | null;
  originalAttentionReason?: string | null;
  originalSnapshot: Record<string, unknown>;
  version: number;
  createdAt: string;
  branch: { id: string; name: string; timezone?: string | null };
  originalProfessional: { id: string; firstName: string; lastName: string };
  originalAppointment: {
    id: string;
    branchId: string;
    professionalId: string;
    chairId?: string | null;
    attendanceMode?: AttendanceMode;
    specialtyId?: string | null;
    treatmentPlanId?: string | null;
    title: string;
    reason?: string | null;
    notes?: string | null;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    patient?: {
      id: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      email?: string | null;
    } | null;
    professional: { id: string; firstName: string; lastName: string };
    branch: { id: string; name: string; timezone?: string | null };
    chair?: { id: string; name: string } | null;
    treatmentPlan?: { id: string; name: string; status: string } | null;
    appointmentNotes: Array<{ id: string; note: string; isPrivate: boolean; createdAt: string }>;
  };
  financialSituation?: {
    treatmentPlanId: string;
    currency: string;
    code: "DEBT" | "AVAILABLE_BALANCE" | "DIAGNOSTIC" | "NO_AVAILABLE_BALANCE" | "CANCELLED";
    label: string;
    severity: "danger" | "success" | "warning" | "neutral";
    amount?: string | null;
  } | null;
};

export type ReprogrammingCasePage = {
  items: ReprogrammingCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RescheduleCasePayload = {
  version: number;
  branchId: string;
  professionalId: string;
  chairId?: string;
  chairIndex?: number;
  attendanceMode?: AttendanceMode;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  initialStatus?: "SCHEDULED" | "PENDING_CONFIRMATION" | "CONFIRMED";
  notes?: string;
  notifyPatient?: boolean;
};

export async function previewMassReprogramming(payload: ReprogrammingCriteria) {
  const { data } = await http.post<ReprogrammingPreview>("/agenda/reprogramming/batches/preview", payload);
  return data;
}

export async function createMassReprogrammingBatch(
  payload: ReprogrammingCriteria & {
    selectedAppointmentIds: string[];
    excludedAppointmentIds?: string[];
  },
  idempotencyKey: string
) {
  const { data } = await http.post<ReprogrammingBatch>("/agenda/reprogramming/batches", payload, {
    headers: { "Idempotency-Key": idempotencyKey }
  });
  return data;
}

export async function retryReprogrammingBatch(batchId: string) {
  const { data } = await http.post<ReprogrammingBatch>(
    `/agenda/reprogramming/batches/${batchId}/retry`,
    {}
  );
  return data;
}

export async function listReprogrammingCases(params: {
  branchId?: string;
  professionalId?: string;
  search?: string;
  status?: ReprogrammingCaseStatus;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await http.get<ReprogrammingCasePage>("/agenda/reprogramming/cases", { params });
  return data;
}

export async function getReprogrammingCase(caseId: string) {
  const { data } = await http.get<ReprogrammingCase>(`/agenda/reprogramming/cases/${caseId}`);
  return data;
}

export async function getReprogrammingAvailability(params: {
  branchId: string;
  professionalId: string;
  chairId?: string;
  chairIndex?: string;
  date: string;
  durationMinutes?: string;
}) {
  const { data } = await http.get<{ slots: AvailabilitySlot[] }>("/agenda/reprogramming/availability", {
    params
  });
  return data;
}

export async function rescheduleAppointmentCase(caseId: string, payload: RescheduleCasePayload) {
  const { data } = await http.post<ReprogrammingCase>(
    `/agenda/reprogramming/cases/${caseId}/reschedule`,
    payload
  );
  return data;
}

export async function definitivelyCancelReprogrammingCase(
  caseId: string,
  payload: { version: number; reason: string; observation?: string }
) {
  const { data } = await http.post<ReprogrammingCase>(
    `/agenda/reprogramming/cases/${caseId}/cancel-definitively`,
    payload
  );
  return data;
}
