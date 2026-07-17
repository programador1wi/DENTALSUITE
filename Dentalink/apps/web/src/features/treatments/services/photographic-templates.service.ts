import { http } from "@/lib/api/http-client";

export type PhotographicSessionType =
  | "INITIAL"
  | "FOLLOW_UP"
  | "REEVALUATION"
  | "FINAL"
  | "CUSTOM"
  | "IMPORTED";
export type PhotographicSessionStatus = "DRAFT" | "INCOMPLETE" | "COMPLETE" | "ARCHIVED" | "VOIDED";
export type PhotographicFrequency =
  | "NONE"
  | "EVERY_CONTROL"
  | "EVERY_3_MONTHS"
  | "EVERY_6_MONTHS"
  | "EVERY_12_MONTHS"
  | "INITIAL_AND_FINAL"
  | "CUSTOM";
export type PhotographicLinkedEntityType = "APPOINTMENT" | "ORTHODONTIC_CONTROL" | "CLINICAL_EVOLUTION";

export type PhotographicSlot = {
  id: string;
  code: string;
  label: string;
  group: string;
  sortOrder: number;
  rowNumber: number;
  columnNumber: number;
  isRequired: boolean;
  recommendedOrientation?: string | null;
  isActive: boolean;
  version: number;
};

export type PhotographicFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type PhotographicImageTransformations = {
  rotation: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  zoom: number;
  brightness: number;
  contrast: number;
};

export type PhotographicSessionImage = {
  id: string;
  sessionId: string;
  slotId: string;
  checksum: string;
  mimeType: string;
  width: number;
  height: number;
  status: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "ERROR" | "REPLACED" | "VOIDED";
  transformationsJson?: PhotographicImageTransformations | null;
  uploadedAt: string;
  version: number;
  slot: PhotographicSlot;
  originalFile: PhotographicFile;
  previewFile?: PhotographicFile | null;
  thumbnailFile?: PhotographicFile | null;
  editedFile?: PhotographicFile | null;
};

export type PhotographicSessionLink = {
  id: string;
  linkedEntityType: PhotographicLinkedEntityType;
  linkedEntityId: string;
  relationshipType: string;
  createdAt: string;
};

export type PhotographicSession = {
  id: string;
  organizationId: string;
  patientId: string;
  treatmentPlanId: string;
  branchId: string;
  professionalId: string;
  name: string;
  sessionType: PhotographicSessionType;
  clinicalDate: string;
  status: PhotographicSessionStatus;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  images: PhotographicSessionImage[];
  links: PhotographicSessionLink[];
};

export type PhotographicPolicy = {
  treatmentPlanId: string;
  frequency: PhotographicFrequency;
  customIntervalDays?: number | null;
  reminderDismissedAt?: string | null;
};

export type PhotographicTemplatesResult = {
  slots: PhotographicSlot[];
  unclassifiedSlot?: PhotographicSlot | null;
  sessions: PhotographicSession[];
  policy: PhotographicPolicy;
  reminder?: { message: string; frequency: PhotographicFrequency } | null;
};

export type PhotographicAvailableLinks = {
  appointments: Array<{ id: string; startAt: string; status: string; professionalId: string }>;
  controls: Array<{
    id: string;
    sequenceNumber: number;
    clinicalDate: string;
    status: string;
    professionalId: string;
  }>;
  evolutions: Array<{
    id: string;
    createdAt: string;
    signedAt?: string | null;
    annulledAt?: string | null;
    professionalId: string;
    notes?: string | null;
  }>;
};

export type CreatePhotographicSessionPayload = {
  name?: string;
  sessionType?: PhotographicSessionType;
  clinicalDate: string;
  professionalId?: string;
  branchId?: string;
  notes?: string;
  links?: Array<{
    linkedEntityType: PhotographicLinkedEntityType;
    linkedEntityId: string;
    relationshipType?: string;
  }>;
};

export async function listPhotographicTemplates(treatmentPlanId: string, includeVoided = false) {
  const { data } = await http.get<PhotographicTemplatesResult>(
    `/treatment-plans/${treatmentPlanId}/photographic-sessions`,
    {
      params: includeVoided ? { includeVoided: "true" } : undefined
    }
  );
  return data;
}

export async function listPhotographicAvailableLinks(treatmentPlanId: string) {
  const { data } = await http.get<PhotographicAvailableLinks>(
    `/treatment-plans/${treatmentPlanId}/photographic-links/available`
  );
  return data;
}

export async function auditPhotographicComparison(sessionId: string, otherSessionId: string) {
  const { data } = await http.get<{ left: PhotographicSession; right: PhotographicSession }>(
    `/photographic-sessions/${sessionId}/comparison`,
    { params: { otherSessionId } }
  );
  return data;
}

export async function updatePhotographicSlot(
  slotId: string,
  payload: Partial<
    Pick<
      PhotographicSlot,
      | "label"
      | "group"
      | "sortOrder"
      | "rowNumber"
      | "columnNumber"
      | "isRequired"
      | "recommendedOrientation"
      | "isActive"
    >
  > & { version: number }
) {
  const { data } = await http.put<PhotographicSlot>(`/photographic-slots/${slotId}`, payload);
  return data;
}

export async function createPhotographicSession(
  treatmentPlanId: string,
  payload: CreatePhotographicSessionPayload
) {
  const { data } = await http.post<PhotographicSession>(
    `/treatment-plans/${treatmentPlanId}/photographic-sessions`,
    payload,
    {
      headers: { "Idempotency-Key": crypto.randomUUID() }
    }
  );
  return data;
}

export async function updatePhotographicSession(
  sessionId: string,
  payload: Partial<CreatePhotographicSessionPayload> & { version: number }
) {
  const { data } = await http.put<PhotographicSession>(`/photographic-sessions/${sessionId}`, payload);
  return data;
}

export async function uploadPhotographicImage(input: {
  treatmentPlanId: string;
  sessionId?: string;
  slotId: string;
  file: File;
  replaceImageId?: string;
  expectedVersion?: number;
}) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("slotId", input.slotId);
  if (input.replaceImageId) form.append("replaceImageId", input.replaceImageId);
  if (input.expectedVersion) form.append("expectedVersion", String(input.expectedVersion));
  const path = input.sessionId
    ? `/photographic-sessions/${input.sessionId}/images`
    : `/treatment-plans/${input.treatmentPlanId}/photographic-sessions/initial/images`;
  const { data } = await http.post<PhotographicSession | PhotographicSessionImage>(path, form);
  return data;
}

export async function updatePhotographicImageTransformations(
  imageId: string,
  payload: PhotographicImageTransformations & { version: number }
) {
  const { data } = await http.put<PhotographicSessionImage>(
    `/photographic-session-images/${imageId}/transformations`,
    payload
  );
  return data;
}

export async function voidPhotographicImage(imageId: string, payload: { version: number; reason: string }) {
  const { data } = await http.post<PhotographicSession>(
    `/photographic-session-images/${imageId}/void`,
    payload
  );
  return data;
}

export async function voidPhotographicSession(
  sessionId: string,
  payload: { version: number; reason: string }
) {
  const { data } = await http.post<PhotographicSession>(`/photographic-sessions/${sessionId}/void`, payload);
  return data;
}

export async function completePhotographicSession(sessionId: string, version: number) {
  const { data } = await http.post<PhotographicSession>(`/photographic-sessions/${sessionId}/complete`, {
    version
  });
  return data;
}

export async function createPhotographicLink(
  sessionId: string,
  payload: {
    linkedEntityType: PhotographicLinkedEntityType;
    linkedEntityId: string;
    relationshipType?: string;
  }
) {
  const { data } = await http.post<PhotographicSessionLink>(
    `/photographic-sessions/${sessionId}/links`,
    payload
  );
  return data;
}

export async function removePhotographicLink(linkId: string, reason: string) {
  const { data } = await http.delete(`/photographic-session-links/${linkId}`, { data: { reason } });
  return data;
}

export async function updatePhotographicPolicy(
  treatmentPlanId: string,
  payload: { frequency: PhotographicFrequency; customIntervalDays?: number | null }
) {
  const { data } = await http.put<PhotographicPolicy>(
    `/treatment-plans/${treatmentPlanId}/photographic-policy`,
    payload
  );
  return data;
}

export async function dismissPhotographicReminder(treatmentPlanId: string, until?: string) {
  const { data } = await http.post<PhotographicPolicy>(
    `/treatment-plans/${treatmentPlanId}/photographic-policy/dismiss-reminder`,
    { until }
  );
  return data;
}

export async function createMobilePhotographicUpload(sessionId: string) {
  const { data } = await http.post<{ uploadUrl: string; expiresAt: string }>(
    `/photographic-sessions/${sessionId}/mobile-upload-session`
  );
  return data;
}

export async function claimMobilePhotographicUpload(token: string) {
  const { data } = await http.get<{
    uploadToken: string;
    expiresAt: string;
    session: { id: string; name: string; clinicalDate: string };
    slots: PhotographicSlot[];
  }>(`/mobile-photographic-uploads/${token}`);
  return data;
}

export async function uploadMobilePhotographicImage(
  token: string,
  slotId: string,
  file: File,
  replaceImageId?: string
) {
  const form = new FormData();
  form.append("file", file);
  form.append("slotId", slotId);
  if (replaceImageId) form.append("replaceImageId", replaceImageId);
  const { data } = await http.post<PhotographicSessionImage>(
    `/mobile-photographic-uploads/${token}/images`,
    form
  );
  return data;
}

export async function completeMobilePhotographicUpload(token: string) {
  const { data } = await http.post<{ completed: true }>(`/mobile-photographic-uploads/${token}/complete`);
  return data;
}

export async function getPhotographicFileBlob(file: PhotographicFile) {
  const { data } = await http.get<Blob>(`/photographic-files/${file.id}/content`, { responseType: "blob" });
  return data;
}
