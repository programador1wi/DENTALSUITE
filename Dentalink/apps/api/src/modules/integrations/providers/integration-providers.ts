import { Injectable } from "@nestjs/common";
import { AiRequestStatus, CommunicationJobStatus } from "@prisma/client";

export type QueueNotificationInput = {
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
};

export type QueueNotificationResult = {
  provider: string;
  status: CommunicationJobStatus;
  providerMessageId?: string;
};

export interface NotificationProvider {
  queue(input: QueueNotificationInput): Promise<QueueNotificationResult>;
}

@Injectable()
export class ManualNotificationProvider implements NotificationProvider {
  async queue(_input: QueueNotificationInput): Promise<QueueNotificationResult> {
    return { provider: "manual", status: CommunicationJobStatus.QUEUED };
  }
}

export interface PaymentProvider {
  validateWebhookSecret(expectedSecret: string | undefined, providedSecret: string | undefined): boolean;
}

@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  validateWebhookSecret(expectedSecret: string | undefined, providedSecret: string | undefined) {
    if (!expectedSecret) return true;
    return Boolean(providedSecret) && providedSecret === expectedSecret;
  }
}

export type StartAiRequestResult = {
  provider: string;
  status: AiRequestStatus;
};

export interface AiProvider {
  start(provider: string | undefined): Promise<StartAiRequestResult>;
}

@Injectable()
export class ManualAiProvider implements AiProvider {
  async start(provider: string | undefined): Promise<StartAiRequestResult> {
    return { provider: provider?.trim() || "manual", status: AiRequestStatus.PROCESSING };
  }
}

export interface PdfProvider {
  buildPlaceholder(entity: string, entityId: string): { provider: string; status: "PENDING" };
}

@Injectable()
export class ManualPdfProvider implements PdfProvider {
  buildPlaceholder(_entity: string, _entityId: string) {
    return { provider: "manual", status: "PENDING" as const };
  }
}
