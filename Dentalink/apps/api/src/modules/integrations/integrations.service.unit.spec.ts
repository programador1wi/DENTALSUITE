import {
  PaymentLinkStatus,
  PaymentWebhookEventStatus,
  Prisma,
  SurveyStatus,
  SurveyType
} from "@prisma/client";
import { IntegrationsService } from "./integrations.service";

function buildService(
  prisma: Record<string, unknown>,
  options: { secret?: string; automationMode?: "MANUAL" | "AUTOMATIC"; validSecret?: boolean } = {}
) {
  return new IntegrationsService(
    prisma as never,
    {
      get: jest.fn((key: string) =>
        key === "PAYMENT_WEBHOOK_SECRET" ? options.secret ?? "whsec_test" : undefined
      )
    } as never,
    { queue: jest.fn() } as never,
    {
      automationMode: options.automationMode ?? "MANUAL",
      validateWebhookSecret: jest.fn().mockReturnValue(options.validSecret ?? true)
    } as never,
    { start: jest.fn() } as never
  );
}

describe("IntegrationsService payment webhooks", () => {
  it("stores manual-provider events without applying automatic payment effects", async () => {
    const paymentLinkUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentLink: {
        findUnique: jest.fn().mockResolvedValue({
          id: "link-1",
          organizationId: "org-1",
          status: PaymentLinkStatus.CREATED
        })
      },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          paymentLink: { update: paymentLinkUpdate },
          paymentWebhookEvent: {
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: "event-1", ...args.data }))
          }
        })
      )
    };
    const service = buildService(prisma);

    const result = await service.ingestPaymentWebhook("stripe", {
      eventId: "evt-1",
      eventType: "payment.succeeded",
      paymentLinkId: "link-1",
      payload: { amount: 100 }
    });

    expect(prisma.paymentWebhookEvent.findUnique).toHaveBeenCalledWith({
      where: { provider_idempotencyKey: { provider: "stripe", idempotencyKey: "evt-1" } }
    });
    const tx = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(tx).toBeDefined();
    expect(result).toEqual({
      duplicate: false,
      event: expect.objectContaining({
        organizationId: "org-1",
        paymentLinkId: "link-1",
        provider: "stripe",
        status: PaymentWebhookEventStatus.IGNORED
      })
    });
    expect(paymentLinkUpdate).not.toHaveBeenCalled();
  });

  it("allows effects only when an automatic provider explicitly declares the capability", async () => {
    const paymentLinkUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      paymentLink: {
        findUnique: jest.fn().mockResolvedValue({
          id: "link-1",
          organizationId: "org-1",
          status: PaymentLinkStatus.CREATED
        })
      },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          paymentLink: { update: paymentLinkUpdate },
          paymentWebhookEvent: {
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: "event-1", ...args.data }))
          }
        })
      )
    };
    const service = buildService(prisma, { automationMode: "AUTOMATIC" });

    await expect(
      service.ingestPaymentWebhook("future-provider", {
        eventId: "evt-auto",
        eventType: "payment.succeeded",
        paymentLinkId: "link-1"
      })
    ).resolves.toEqual({
      duplicate: false,
      event: expect.objectContaining({ status: PaymentWebhookEventStatus.PROCESSED })
    });
    expect(paymentLinkUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns duplicate webhook events without reprocessing the payment link", async () => {
    const existing = { id: "event-1", provider: "stripe", idempotencyKey: "evt-1" };
    const prisma = {
      paymentWebhookEvent: { findUnique: jest.fn().mockResolvedValue(existing) },
      paymentLink: { findUnique: jest.fn() },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn()
    };
    const service = buildService(prisma);

    await expect(
      service.ingestPaymentWebhook("stripe", { eventId: "evt-1", eventType: "payment.succeeded" })
    ).resolves.toEqual({ event: existing, duplicate: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("fails closed when the webhook secret is missing", async () => {
    const prisma = {
      paymentWebhookEvent: { findUnique: jest.fn() },
      paymentLink: { findUnique: jest.fn() },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn()
    };
    const service = buildService(prisma, { secret: "" });

    await expect(
      service.ingestPaymentWebhook("manual", { eventId: "evt-1", eventType: "payment.succeeded" })
    ).rejects.toThrow("Payment webhook secret is not configured");
    expect(prisma.paymentWebhookEvent.findUnique).not.toHaveBeenCalled();
  });

  it("returns the stored event when concurrent inserts collide on the idempotency key", async () => {
    const existing = { id: "event-existing", provider: "manual", idempotencyKey: "evt-race" };
    const prisma = {
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
      },
      paymentLink: {
        findUnique: jest.fn().mockResolvedValue({
          id: "link-1",
          organizationId: "org-1",
          status: PaymentLinkStatus.CREATED
        })
      },
      payment: { findUnique: jest.fn() },
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "7.8.0"
        })
      )
    };
    const service = buildService(prisma);

    await expect(
      service.ingestPaymentWebhook("manual", {
        eventId: "evt-race",
        eventType: "payment.succeeded",
        paymentLinkId: "link-1"
      })
    ).resolves.toEqual({ event: existing, duplicate: true });
  });
});

describe("IntegrationsService surveys", () => {
  it("classifies NPS survey responses as promoters", async () => {
    const prisma = {
      survey: { findUnique: jest.fn().mockResolvedValue({ id: "survey-1", type: SurveyType.NPS }) },
      $transaction: jest.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          survey: {
            update: jest.fn().mockImplementation((args) =>
              Promise.resolve({ id: "survey-1", status: SurveyStatus.COMPLETED, ...args.data })
            )
          },
          npsResponse: {
            upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: "nps-1", ...args.create }))
          }
        })
      )
    };
    const service = buildService(prisma);

    const result = await service.submitSurveyResponse("token-1", { score: 10, comment: "Excelente" });

    expect(result).toEqual({
      survey: expect.objectContaining({ status: SurveyStatus.COMPLETED, score: 10 }),
      npsResponse: expect.objectContaining({ category: "PROMOTER", score: 10 })
    });
  });
});
