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

import { timingSafeEqual } from "node:crypto";

export interface PaymentProvider {
  readonly automationMode: "MANUAL" | "AUTOMATIC";
  validateWebhookSecret(expectedSecret: string | undefined, providedSecret: string | undefined): boolean;
}

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly automationMode = "MANUAL" as const;

  validateWebhookSecret(expectedSecret: string | undefined, providedSecret: string | undefined): boolean {
    if (!expectedSecret || !providedSecret) return false;
    const expectedBuf = Buffer.from(expectedSecret, "utf8");
    const providedBuf = Buffer.from(providedSecret, "utf8");
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
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
