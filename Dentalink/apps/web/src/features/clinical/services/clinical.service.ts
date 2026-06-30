import { http } from "@/lib/api/http-client";

export type MedicalHistory = {
  id: string;
  patientId: string;
  bloodType?: string | null;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasHeartDisease: boolean;
  isPregnant: boolean;
  smokes: boolean;
  drinksAlcohol: boolean;
  notes?: string | null;
};

export type ClinicalSummary = {
  history: MedicalHistory | null;
  conditions: Array<{ id: string; name: string; notes?: string | null; isActive: boolean }>;
  allergies: Array<{ id: string; name: string; reaction?: string | null; severity?: string | null; notes?: string | null }>;
  medications: Array<{ id: string; name: string; dosage?: string | null; frequency?: string | null; notes?: string | null }>;
  alerts: Array<{ id: string; type: string; description: string; severity: string; isActive: boolean }>;
};

export type ClinicalAppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "PENDING_CONFIRMATION"
  | "ARRIVED"
  | "WAITING_ROOM"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_CLINIC"
  | "NO_SHOW"
  | "RESCHEDULED"
  | "BLOCKED";

export type ClinicalAppointmentHistoryItem = {
  id: string;
  title: string;
  reason?: string | null;
  status: ClinicalAppointmentStatus;
  startAt: string;
  endAt: string;
  cancellationReason?: string | null;
  branch?: { id: string; name: string } | null;
  patient?: { id: string; firstName: string; lastName: string; documentNumber?: string | null } | null;
  professional: { id: string; firstName: string; lastName: string };
  specialty?: { id: string; name: string } | null;
};

export type ClinicalEvolution = {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  professionalId: string;
  treatmentPlanId?: string | null;
  treatmentPlanItemId?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  notes?: string | null;
  isPrivate: boolean;
  signedAt?: string | null;
  annulledAt?: string | null;
  annulReason?: string | null;
  actionNameSnapshot?: string | null;
  professional: { firstName: string; lastName: string };
  signedBy?: { firstName: string; lastName: string } | null;
  annulledBy?: { firstName: string; lastName: string } | null;
  createdBy?: { firstName: string; lastName: string } | null;
  addenda?: ClinicalEvolution[];
  fields?: Array<{ label: string; value: string; group?: string | null; sortOrder: number }>;
  materials?: Array<{ id: string; inventoryItemId: string; quantity: string | number; unitSnapshot?: string | null; nameSnapshot?: string | null; inventoryItem?: { name: string; unit: string } }>;
  treatmentPlanItem?: { procedure?: { name: string; code: string }; treatmentPlan?: { name: string; displayId: string } };
};

export type Prescription = {
  id: string;
  diagnosis?: string | null;
  notes?: string | null;
  status: string;
  treatmentPlanId?: string | null;
  treatmentPlan?: { id: string; name: string } | null;
  createdAt: string;
  professional: { firstName: string; lastName: string };
  items: Array<{ id: string; medication: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }>;
  printableText?: string;
};

export type ClinicalDocument = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  template?: { id: string; name: string } | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
};

export type ClinicalDocumentTemplate = {
  id: string;
  name: string;
  description?: string | null;
  content: string;
};

export type ToothProcedureStatus = "PLANNED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type OdontogramRecord = {
  id: string;
  toothNumber: string;
  surface?: string | null;
  condition: string;
  diagnosis?: string | null;
  status: ToothProcedureStatus;
  notes?: string | null;
  createdAt: string;
  procedure?: { id: string; code: string; name: string } | null;
  professional?: { id: string; firstName: string; lastName: string } | null;
};

export type ToothCondition = {
  id: string;
  odontogramRecordId?: string | null;
  toothNumber: string;
  surface?: string | null;
  condition: string;
  diagnosis?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type ToothProcedure = {
  id: string;
  toothNumber: string;
  surface?: string | null;
  diagnosis?: string | null;
  status: ToothProcedureStatus;
  notes?: string | null;
  procedureId?: string | null;
  clinicalEvolutionId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  procedure?: { id: string; code: string; name: string } | null;
  professional?: { id: string; firstName: string; lastName: string } | null;
};

export type OdontogramPayload = {
  records: OdontogramRecord[];
  conditions: ToothCondition[];
  procedures: ToothProcedure[];
  latestByTooth: Record<string, OdontogramRecord>;
};

export type PeriodontalPosition = "MB" | "B" | "DB" | "ML" | "L" | "DL";

export type PeriodontalMeasurement = {
  id?: string;
  toothNumber: string;
  position: PeriodontalPosition;
  probingDepth: number;
  bleeding: boolean;
  plaque: boolean;
  recession?: number | null;
  mobility?: number | null;
  furcation?: string | null;
  suppuration: boolean;
};

export type PeriodontalChart = {
  id: string;
  chartDate: string;
  notes?: string | null;
  professional?: { id: string; firstName: string; lastName: string } | null;
  measurements: PeriodontalMeasurement[];
};

export type PeriodontalComparison = {
  chartA: { id: string; chartDate: string; notes?: string | null };
  chartB: { id: string; chartDate: string; notes?: string | null };
  items: Array<{
    toothNumber: string;
    position: PeriodontalPosition;
    chartA: PeriodontalMeasurement | null;
    chartB: PeriodontalMeasurement | null;
    probingDepthDelta: number;
    recessionDelta: number;
    mobilityDelta: number;
    bleedingChanged: boolean;
    plaqueChanged: boolean;
    suppurationChanged: boolean;
  }>;
};

export async function getClinicalSummary(patientId: string) {
  const { data } = await http.get<ClinicalSummary>(`/patients/${patientId}/clinical/history`);
  return data;
}

export async function listAppointmentHistory(patientId: string) {
  const { data } = await http.get<ClinicalAppointmentHistoryItem[]>(`/patients/${patientId}/clinical/appointment-history`);
  return data;
}

export async function upsertMedicalHistory(patientId: string, payload: Partial<MedicalHistory>) {
  const { data } = await http.put<MedicalHistory>(`/patients/${patientId}/clinical/history`, payload);
  return data;
}

export async function createAllergy(patientId: string, payload: { name: string; reaction?: string; severity?: string; notes?: string }) {
  const { data } = await http.post(`/patients/${patientId}/clinical/allergies`, payload);
  return data;
}

export async function createMedication(patientId: string, payload: { name: string; dosage?: string; frequency?: string; notes?: string }) {
  const { data } = await http.post(`/patients/${patientId}/clinical/medications`, payload);
  return data;
}

export async function createCondition(patientId: string, payload: { name: string; notes?: string }) {
  const { data } = await http.post(`/patients/${patientId}/clinical/conditions`, payload);
  return data;
}

export async function listEvolutions(patientId: string) {
  const { data } = await http.get<ClinicalEvolution[]>(`/patients/${patientId}/clinical/evolutions`);
  return data;
}

export async function createEvolution(patientId: string, payload: Record<string, unknown>) {
  const { data } = await http.post<ClinicalEvolution>(`/patients/${patientId}/clinical/evolutions`, payload);
  return data;
}

export async function signEvolution(patientId: string, evolutionId: string) {
  const { data } = await http.post<ClinicalEvolution>(`/patients/${patientId}/clinical/evolutions/${evolutionId}/sign`, {});
  return data;
}

export async function createEvolutionAddendum(patientId: string, evolutionId: string, payload: { professionalId: string; notes: string }) {
  const { data } = await http.post<ClinicalEvolution>(`/patients/${patientId}/clinical/evolutions/${evolutionId}/addendum`, payload);
  return data;
}

export async function listPrescriptions(patientId: string) {
  const { data } = await http.get<Prescription[]>(`/patients/${patientId}/clinical/prescriptions`);
  return data;
}

export async function createPrescription(patientId: string, payload: Record<string, unknown>) {
  const { data } = await http.post<Prescription>(`/patients/${patientId}/clinical/prescriptions`, payload);
  return data;
}

export async function printPrescription(patientId: string, prescriptionId: string) {
  const { data } = await http.get<Prescription>(`/patients/${patientId}/clinical/prescriptions/${prescriptionId}/print`);
  return data;
}

export async function updatePrescriptionStatus(patientId: string, prescriptionId: string, status: string) {
  const { data } = await http.patch<Prescription>(`/patients/${patientId}/clinical/prescriptions/${prescriptionId}/status`, { status });
  return data;
}

export async function listDocuments(patientId: string) {
  const { data } = await http.get<ClinicalDocument[]>(`/patients/${patientId}/clinical/documents`);
  return data;
}

export async function listDocumentTemplates(patientId: string) {
  const { data } = await http.get<ClinicalDocumentTemplate[]>(`/patients/${patientId}/clinical/document-templates`);
  return data;
}

export async function createDocumentFromTemplate(patientId: string, payload: { templateId: string; title: string }) {
  const { data } = await http.post<ClinicalDocument>(`/patients/${patientId}/clinical/documents/from-template`, payload);
  return data;
}

export async function createDocumentTemplate(patientId: string, payload: { name: string; description?: string; content: string }) {
  const { data } = await http.post<ClinicalDocumentTemplate>(`/patients/${patientId}/clinical/document-templates`, payload);
  return data;
}

export async function getOdontogram(patientId: string, toothNumber?: string) {
  const { data } = await http.get<OdontogramPayload>(`/patients/${patientId}/clinical/odontogram`, {
    params: toothNumber ? { toothNumber } : undefined
  });
  return data;
}

export async function getToothHistory(patientId: string, toothNumber: string) {
  const { data } = await http.get<{
    toothNumber: string;
    records: OdontogramRecord[];
    conditions: ToothCondition[];
    procedures: ToothProcedure[];
  }>(`/patients/${patientId}/clinical/odontogram/history/${toothNumber}`);
  return data;
}

export async function createToothCondition(
  patientId: string,
  payload: { professionalId: string; appointmentId?: string; toothNumber: string; surface?: string; condition: string; diagnosis?: string; notes?: string }
) {
  const { data } = await http.post(`/patients/${patientId}/clinical/odontogram/conditions`, payload);
  return data;
}

export async function cancelOdontogramRecord(patientId: string, odontogramRecordId: string) {
  const { data } = await http.patch<OdontogramRecord>(`/patients/${patientId}/clinical/odontogram/records/${odontogramRecordId}/cancel`, {});
  return data;
}

export async function createToothProcedure(
  patientId: string,
  payload: {
    professionalId: string;
    appointmentId?: string;
    procedureId?: string;
    treatmentPlanId?: string;
    toothNumber: string;
    surface?: string;
    diagnosis?: string;
    status?: ToothProcedureStatus;
    notes?: string;
  }
) {
  const { data } = await http.post<ToothProcedure>(`/patients/${patientId}/clinical/odontogram/procedures`, payload);
  return data;
}

export async function updateToothProcedureStatus(
  patientId: string,
  toothProcedureId: string,
  payload: { status: ToothProcedureStatus; notes?: string; createClinicalEvolution?: boolean }
) {
  const { data } = await http.patch<ToothProcedure>(`/patients/${patientId}/clinical/odontogram/procedures/${toothProcedureId}/status`, payload);
  return data;
}

export async function listPeriodontalCharts(patientId: string) {
  const { data } = await http.get<PeriodontalChart[]>(`/patients/${patientId}/clinical/periodontogram`);
  return data;
}

export async function createPeriodontalChart(
  patientId: string,
  payload: {
    professionalId: string;
    appointmentId?: string;
    chartDate: string;
    notes?: string;
    measurements: PeriodontalMeasurement[];
  }
) {
  const { data } = await http.post<PeriodontalChart>(`/patients/${patientId}/clinical/periodontogram`, payload);
  return data;
}

export async function comparePeriodontalCharts(patientId: string, chartAId: string, chartBId: string) {
  const { data } = await http.get<PeriodontalComparison>(`/patients/${patientId}/clinical/periodontogram/compare`, {
    params: { chartAId, chartBId }
  });
  return data;
}

export async function deleteClinicalDocument(patientId: string, documentId: string, payload: { reason: string }) {
  const { data } = await http.delete(`/patients/${patientId}/clinical/documents/${documentId}`, { data: payload });
  return data;
}


export async function annulEvolution(patientId: string, evolutionId: string, reason: string) {
  const { data } = await http.post<ClinicalEvolution>(`/patients/${patientId}/clinical/evolutions/${evolutionId}/annul`, { reason });
  return data;
}


export async function updateEvolution(patientId: string, evolutionId: string, payload: Record<string, unknown>) {
  const { data } = await http.patch<ClinicalEvolution>(`/patients/${patientId}/clinical/evolutions/${evolutionId}`, payload);
  return data;
}
