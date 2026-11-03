import {
  CommunicationJobStatus,
  ImportJobStatus,
  MessageDeliveryStatus,
  Prisma
} from "@prisma/client";

export function deliveryStatusToJobUpdate(
  status: MessageDeliveryStatus,
  errorMessage: string | undefined,
  now: Date
): Prisma.CommunicationJobUpdateInput {
  if (status === MessageDeliveryStatus.FAILED) {
    return { status: CommunicationJobStatus.FAILED, failedAt: now, errorMessage: errorMessage?.trim() };
  }
  if (status === MessageDeliveryStatus.QUEUED) {
    return { status: CommunicationJobStatus.QUEUED, queuedAt: now };
  }
  return { status: CommunicationJobStatus.SENT, sentAt: now, failedAt: null, errorMessage: null };
}

export function resolveSurveyRecipient(
  channel: string,
  patient: { email: string | null; phone: string | null }
) {
  if (channel === "EMAIL") return patient.email?.trim();
  if (["WHATSAPP", "SMS", "PHONE"].includes(channel)) return patient.phone?.trim();
  return patient.email?.trim() || patient.phone?.trim();
}

export function npsCategory(score: number) {
  if (score >= 9) return "PROMOTER";
  if (score >= 7) return "PASSIVE";
  return "DETRACTOR";
}

export function isTerminalImportStatus(status: ImportJobStatus) {
  return (
    status === ImportJobStatus.COMPLETED ||
    status === ImportJobStatus.FAILED ||
    status === ImportJobStatus.CANCELLED
  );
}

export function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
