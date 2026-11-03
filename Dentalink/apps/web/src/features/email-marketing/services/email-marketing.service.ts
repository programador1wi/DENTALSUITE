import { http } from "@/lib/api/http-client";

export type ReportParameter = {
  key: string;
  label: string;
  type: "number" | "date" | "month" | "branch" | "professional" | "agreement" | "patientStatus" | "boolean";
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
};

export type MarketingReportDefinition = {
  code: string;
  name: string;
  description: string;
  category: string;
  requiredParameters: ReportParameter[];
  optionalParameters: ReportParameter[];
  resultColumns: string[];
  professionalMeaning?: string;
  exportable: boolean;
};

export type EligibilityReason = { code: string; label: string };

export type MarketingPatientRow = Record<string, unknown> & {
  patientId: string;
  documentNumber: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  branch: string;
  professional: string | null;
  lastAppointment: string | null;
  lastAttentionAt: string | null;
  debt: number;
  agreement: string | null;
  eligible: boolean;
  eligibilityReasons: EligibilityReason[];
};

export type MarketingReportResponse = {
  report: MarketingReportDefinition;
  parameters: Record<string, unknown>;
  items: MarketingPatientRow[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
  summary: { results: number; visible: number; eligible: number; ineligible: number };
};

export type SenderConfiguration = {
  organization: { name: string; email?: string | null };
  defaultSender: { fromAddress: string; fromName: string; provider: string };
  domains: DomainVerification[];
  branches: Array<{ id: string; name: string }>;
  professionals: Array<{ id: string; firstName: string; lastName: string }>;
  agreements: Array<{ id: string; name: string }>;
};

export type DomainVerification = {
  id: string;
  domain: string;
  fromName: string;
  fromLocalPart: string;
  replyTo?: string | null;
  status: "PENDING" | "VERIFIED" | "FAILED" | "INACTIVE";
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  dnsRecordsJson: Array<{ type: string; name: string; value: string; purpose: string }>;
  failureReason?: string | null;
};

export type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  subject: string;
  preheader?: string | null;
  html: string;
  text: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  updatedAt: string;
};

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt?: string | null;
  createdAt: string;
  fromAddress: string;
  _count?: { recipients: number };
  recipients?: Array<{ id: string; nameSnapshot: string; emailSnapshot: string; deliveryStatus: string }>;
  metrics?: Record<string, number>;
  segment?: { name: string; reportCode: string } | null;
};

export type MarketingSettings = {
  campaignCooldownDays: number;
  maxRecipientsPerCampaign: number;
  maxCampaignsPerMonth: number;
  maxDailyEmails: number;
  allowAttachments: boolean;
  allowInlineImages: boolean;
  requireMarketingConsent: boolean;
  requireVerifiedDomain: boolean;
  sendWindowStart: string;
  sendWindowEnd: string;
};

export async function getMarketingReports() {
  const { data } = await http.get<MarketingReportDefinition[]>("/crm/email-marketing/reports");
  return data;
}

export async function previewMarketingReport(
  code: string,
  payload: {
    parameters: Record<string, unknown>;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
) {
  const { data } = await http.post<MarketingReportResponse>(
    `/crm/email-marketing/reports/${code}/preview`,
    payload
  );
  return data;
}

export async function exportMarketingReport(
  code: string,
  payload: {
    parameters: Record<string, unknown>;
    scope: "ALL" | "ELIGIBLE" | "SELECTED" | "INELIGIBLE";
    selectedPatientIds?: string[];
  }
) {
  const { data } = await http.post<{ fileName: string; mimeType: string; base64: string; rowCount: number }>(
    `/crm/email-marketing/reports/${code}/export`,
    payload
  );
  const bytes = Uint8Array.from(atob(data.base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = data.fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return data;
}

export async function getSenderConfiguration() {
  const { data } = await http.get<SenderConfiguration>("/crm/email-marketing/sender");
  return data;
}

export async function listCampaigns() {
  const { data } = await http.get<EmailCampaign[]>("/crm/email-marketing/campaigns");
  return data;
}

export async function createCampaign(payload: {
  name: string;
  subject: string;
  preheader?: string;
  reportCode: string;
  parameters: Record<string, unknown>;
  patientIds: string[];
  branchId?: string;
  templateId?: string;
  contentHtml?: string;
  contentText?: string;
  fromName?: string;
  replyTo?: string;
  tags?: string[];
  idempotencyKey: string;
}) {
  const { data } = await http.post<EmailCampaign>("/crm/email-marketing/campaigns", payload);
  return data;
}

export async function sendCampaignTest(id: string, email: string) {
  const { data } = await http.post<{ sent: boolean; providerMessageId?: string }>(
    `/crm/email-marketing/campaigns/${id}/test`,
    { email }
  );
  return data;
}

export async function sendCampaignNow(id: string) {
  const { data } = await http.post<EmailCampaign>(`/crm/email-marketing/campaigns/${id}/send`);
  return data;
}

export async function scheduleCampaign(id: string, scheduledAt: string) {
  const { data } = await http.post<EmailCampaign>(`/crm/email-marketing/campaigns/${id}/schedule`, {
    scheduledAt
  });
  return data;
}

export async function listTemplates() {
  const { data } = await http.get<EmailTemplate[]>("/crm/email-marketing/templates");
  return data;
}

export async function createTemplate(payload: {
  name: string;
  category: string;
  subject: string;
  preheader?: string;
  html: string;
  text: string;
}) {
  const { data } = await http.post<EmailTemplate>("/crm/email-marketing/templates", payload);
  return data;
}

export async function archiveTemplate(id: string) {
  const { data } = await http.post<EmailTemplate>(`/crm/email-marketing/templates/${id}/archive`);
  return data;
}

export async function getMarketingSettings() {
  const { data } = await http.get<MarketingSettings>("/crm/email-marketing/settings");
  return data;
}

export async function updateMarketingSettings(payload: Partial<MarketingSettings>) {
  const { data } = await http.patch<MarketingSettings>("/crm/email-marketing/settings", payload);
  return data;
}

export async function createDomain(payload: {
  domain: string;
  fromName: string;
  fromLocalPart?: string;
  replyTo?: string;
}) {
  const { data } = await http.post<DomainVerification>("/crm/email-marketing/domains", payload);
  return data;
}

export async function verifyDomain(id: string) {
  const { data } = await http.post<DomainVerification>(`/crm/email-marketing/domains/${id}/verify`);
  return data;
}
