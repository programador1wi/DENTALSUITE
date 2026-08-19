import { http } from "@/lib/api/http-client";

export type PatientFieldConfigRecord = {
  id?: string;
  fieldKey: string;
  newPatientPresent: boolean;
  newPatientRequired: boolean;
  appointmentPresent: boolean;
  appointmentRequired: boolean;
  onlineAgendaPresent: boolean;
  onlineAgendaRequired: boolean;
  checkInPresent: boolean;
  checkInRequired: boolean;
  isSystemRequired?: boolean;
};

export async function getPatientFieldConfig(): Promise<PatientFieldConfigRecord[]> {
  const { data } = await http.get<PatientFieldConfigRecord[]>("/patient-field-config");
  return data;
}

export async function updatePatientFieldConfig(fields: PatientFieldConfigRecord[]): Promise<PatientFieldConfigRecord[]> {
  const { data } = await http.put<PatientFieldConfigRecord[]>("/patient-field-config", { fields });
  return data;
}
