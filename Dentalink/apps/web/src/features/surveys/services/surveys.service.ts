import { http } from "@/lib/api/http-client";

export type SurveyType = "SATISFACTION" | "NPS" | "CUSTOM";
export type SurveyDefinitionStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type SurveyVersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";
export type SurveyQuestionType =
  | "LIKERT_5"
  | "NPS_10"
  | "YES_NO"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "FREE_TEXT"
  | "STAR_RATING";

export type SurveyOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

export type SurveyQuestion = {
  id: string;
  text: string;
  description?: string | null;
  type: SurveyQuestionType;
  isRequired: boolean;
  position: number;
  validationJson?: Record<string, unknown> | null;
  options: SurveyOption[];
};

export type SurveySection = {
  id: string;
  name: string;
  description?: string | null;
  position: number;
  questions: SurveyQuestion[];
};

export type SurveyVersion = {
  id: string;
  version: number;
  status: SurveyVersionStatus;
  emailSubject: string;
  emailHeaderHtml: string;
  emailFooterHtml: string;
  publishedAt?: string | null;
  sections: SurveySection[];
};

export type SurveyDefinitionListItem = {
  id: string;
  organizationId: string;
  branchId?: string | null;
  name: string;
  type: SurveyType;
  channel: "EMAIL";
  status: SurveyDefinitionStatus;
  activeVersionId?: string | null;
  createdByName: string;
  invitationCount: number;
  responseCount: number;
  updatedAt: string;
  versions: Pick<SurveyVersion, "id" | "version" | "status" | "publishedAt">[];
};

export type SurveySendConfiguration = {
  id: string;
  surveyId: string;
  branchIds?: string[] | null;
  professionalIds?: string[] | null;
  specialtyIds?: string[] | null;
  appointmentTypes?: string[] | null;
  channel: "EMAIL";
  triggerEvent: "APPOINTMENT_COMPLETED";
  delayMinutes: number;
  minimumFrequencyDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  maxRetries: number;
  reminderEnabled: boolean;
  reminderDelayMinutes?: number | null;
  requireConsent: boolean;
  isActive: boolean;
  survey?: Pick<SurveyDefinitionListItem, "id" | "name" | "type" | "status" | "branchId">;
};

export type SurveyDefinition = Omit<SurveyDefinitionListItem, "createdByName"> & {
  versions: SurveyVersion[];
  draftVersion?: SurveyVersion | null;
  activeVersion?: SurveyVersion | null;
  editorVersion?: SurveyVersion | null;
  sendConfiguration?: SurveySendConfiguration | null;
};

export type SurveyListEnvelope = {
  items: SurveyDefinitionListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type SurveyResults = {
  metrics: {
    generated: number;
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    started: number;
    responded: number;
    expired: number;
    bounced: number;
    failed: number;
    responseRate: number;
    average?: number | null;
    nps?: number | null;
    promoters: number;
    passives: number;
    detractors: number;
  };
  questions: {
    id: string;
    text: string;
    type: SurveyQuestionType;
    answerCount: number;
    average?: number | null;
    distribution: { optionId: string; label: string; count: number; percentage: number }[];
    textResponses: string[];
  }[];
};

export type PublicSurvey =
  | { state: "RESPONDED" | "EXPIRED"; message: string }
  | {
      state: "READY";
      survey: {
        name: string;
        type: SurveyType;
        version: number;
        welcomeHtml: string;
        footerHtml: string;
        sections: SurveySection[];
      };
      brand: {
        organizationName: string;
        branchName: string;
        logoUrl?: string | null;
        primaryColor?: string | null;
      };
    };

export type SurveyQuestionPayload = {
  text: string;
  description?: string | null;
  type: SurveyQuestionType;
  isRequired?: boolean;
  options?: { id?: string; label: string; value?: string }[];
};

export type SurveyResultsFilters = {
  surveyId?: string;
  versionId?: string;
  branchId?: string;
  professionalId?: string;
  specialtyId?: string;
  channel?: "EMAIL";
  from?: string;
  to?: string;
};

export async function listSurveyDefinitions(params?: {
  search?: string;
  status?: SurveyDefinitionStatus;
  type?: SurveyType;
  branchId?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await http.get<SurveyListEnvelope>("/crm/surveys", { params });
  return data;
}

export async function createSurveyDefinition(type: SurveyType = "SATISFACTION", branchId?: string) {
  const { data } = await http.post<SurveyDefinition>("/crm/surveys", { type, branchId });
  return data;
}

export async function getSurveyDefinition(id: string) {
  const { data } = await http.get<SurveyDefinition>(`/crm/surveys/${id}`);
  return data;
}

export async function prepareSurveyDraft(id: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${id}/draft`);
  return data;
}

export async function updateSurveyDefinition(id: string, payload: {
  name?: string;
  type?: SurveyType;
  branchId?: string | null;
  emailSubject?: string;
  emailHeaderHtml?: string;
  emailFooterHtml?: string;
}) {
  const { data } = await http.patch<SurveyDefinition>(`/crm/surveys/${id}`, payload);
  return data;
}

export async function duplicateSurveyDefinition(id: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${id}/duplicate`);
  return data;
}

export async function activateSurveyDefinition(id: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${id}/activate`);
  return data;
}

export async function deactivateSurveyDefinition(id: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${id}/deactivate`);
  return data;
}

export async function archiveSurveyDefinition(id: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${id}/archive`);
  return data;
}

export async function addSurveySection(surveyId: string) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${surveyId}/sections`, {});
  return data;
}

export async function updateSurveySection(id: string, payload: { name?: string; description?: string | null }) {
  const { data } = await http.patch<SurveyDefinition>(`/crm/survey-sections/${id}`, payload);
  return data;
}

export async function deleteSurveySection(id: string) {
  const { data } = await http.delete<SurveyDefinition>(`/crm/survey-sections/${id}`);
  return data;
}

export async function reorderSurveySections(surveyId: string, ids: string[]) {
  const { data } = await http.post<SurveyDefinition>(`/crm/surveys/${surveyId}/sections/reorder`, { ids });
  return data;
}

export async function addSurveyQuestion(sectionId: string, payload: SurveyQuestionPayload) {
  const { data } = await http.post<SurveyDefinition>(`/crm/survey-sections/${sectionId}/questions`, payload);
  return data;
}

export async function updateSurveyQuestion(id: string, payload: Partial<SurveyQuestionPayload>) {
  const { data } = await http.patch<SurveyDefinition>(`/crm/survey-questions/${id}`, payload);
  return data;
}

export async function deleteSurveyQuestion(id: string) {
  const { data } = await http.delete<SurveyDefinition>(`/crm/survey-questions/${id}`);
  return data;
}

export async function reorderSurveyQuestions(sectionId: string, ids: string[]) {
  const { data } = await http.post<SurveyDefinition>(`/crm/survey-sections/${sectionId}/questions/reorder`, { ids });
  return data;
}

export async function listSurveySendConfigurations() {
  const { data } = await http.get<SurveySendConfiguration[]>("/crm/survey-send-config");
  return data;
}

export async function updateSurveySendConfiguration(payload: Omit<SurveySendConfiguration, "id" | "survey">) {
  const { data } = await http.put<SurveySendConfiguration>("/crm/survey-send-config", payload);
  return data;
}

export async function getSurveyResults(filters?: SurveyResultsFilters) {
  const { data } = await http.get<SurveyResults>("/crm/surveys/results", { params: filters });
  return data;
}

export async function exportSurveyResults(filters?: SurveyResultsFilters) {
  const { data } = await http.post<{ fileName: string; mimeType: string; contentBase64: string }>("/crm/surveys/results/export", filters ?? {});
  const binary = atob(data.contentBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = data.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return data;
}

export async function getPublicSurvey(token: string) {
  const { data } = await http.get<PublicSurvey>(`/public/surveys/respond/${encodeURIComponent(token)}`);
  return data;
}

export async function startPublicSurvey(token: string) {
  const { data } = await http.post<{ responseId: string; state: "STARTED" }>(`/public/surveys/respond/${encodeURIComponent(token)}/start`);
  return data;
}

export async function submitPublicSurvey(token: string, answers: {
  questionId: string;
  optionId?: string;
  optionIds?: string[];
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
}[]) {
  const { data } = await http.post<{ state: "SUBMITTED"; responseId: string; message: string }>(
    `/public/surveys/respond/${encodeURIComponent(token)}/submit`,
    { answers }
  );
  return data;
}
