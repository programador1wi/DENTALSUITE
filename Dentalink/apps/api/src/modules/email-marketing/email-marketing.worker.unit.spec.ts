import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { EmailCampaignStatus, EmailRecipientStatus } from "@prisma/client";
import { EmailMarketingWorker } from "./email-marketing.worker";

const patient = {
  id: "patient-1",
  branchId: "branch-1",
  firstName: "Jane",
  lastName: "Doe",
  branch: { name: "Main", phone: "", address: "" },
  organization: { name: "Clinic" }
};

const recipient = {
  id: "recipient-1",
  campaignId: "campaign-1",
  patientId: "patient-1",
  patient,
  emailSnapshot: "jane@example.com",
  idempotencyKey: "campaign-1:patient-1:1",
  attempts: 1,
  deliveryStatus: EmailRecipientStatus.QUEUED
};

const campaign = {
  id: "campaign-1",
  organizationId: "org-1",
  branchId: "branch-1",
  createdById: "user-1",
  status: EmailCampaignStatus.SENDING,
  startedAt: new Date(),
  reportCodeSnapshot: null,
  replyTo: null,
  fromAddress: "mail@example.com",
  fromName: "Clinic",
  subject: "Hello",
  contentHtmlSnapshot: "<p>Hello</p>",
  contentTextSnapshot: "Hello",
  organization: { id: "org-1" },
  branch: { id: "branch-1" }
};

function fixture() {
  const emailCampaignRecipient = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
    findFirst: jest.fn().mockResolvedValue(recipient)
  };
  const tx = {
    emailCampaignRecipient: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    emailEvent: { create: jest.fn().mockResolvedValue({}) }
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValueOnce([{ id: recipient.id }]).mockResolvedValueOnce([]),
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === "function") return input(tx);
      return input;
    }),
    emailCampaignRecipient,
    emailCampaign: { updateMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    marketingSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn() }
  };
  const email = { sendPatientEmail: jest.fn().mockResolvedValue({ providerMessageId: "provider-1" }) };
  const marketing = {
    eligibilityPolicy: jest.fn().mockReturnValue({}),
    renderContent: jest.fn((content: string) => content)
  };
  const eligibility = { evaluateMany: jest.fn().mockResolvedValue([{ eligible: true, reasons: [] }]) };
  const worker = new EmailMarketingWorker(
    prisma as never,
    email as never,
    marketing as never,
    eligibility as never,
    new ConfigService({ API_PUBLIC_URL: "https://api.example.com", MARKETING_RECIPIENT_LEASE_MS: "15000" })
  );
  return { worker, prisma, emailCampaignRecipient, email, tx };
}

describe("EmailMarketingWorker recipient leases", () => {
  it("allows only one worker to claim a recipient with SKIP LOCKED", async () => {
    const first = fixture();
    const second = fixture();
    const sharedClaim = jest.fn().mockResolvedValueOnce([{ id: recipient.id }]).mockResolvedValueOnce([]);
    first.prisma.$queryRaw = sharedClaim;
    second.prisma.$queryRaw = sharedClaim;

    const [firstResult, secondResult] = await Promise.all([
      (first.worker as unknown as { claimRecipient(id: string): Promise<unknown> }).claimRecipient(campaign.id),
      (second.worker as unknown as { claimRecipient(id: string): Promise<unknown> }).claimRecipient(campaign.id)
    ]);

    expect([firstResult, secondResult].filter(Boolean)).toHaveLength(1);
    const sql = sharedClaim.mock.calls[0][0].join(" ");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain('"leaseOwner"');
  });

  it("uses a stable provider idempotency key and marks accepted-but-unpersisted delivery uncertain", async () => {
    const value = fixture();
    value.prisma.$transaction.mockRejectedValueOnce(new Error("database unavailable after SMTP acceptance"));

    await (value.worker as unknown as { processCampaign(value: unknown): Promise<void> }).processCampaign(campaign);

    expect(value.email.sendPatientEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "jane@example.com",
      idempotencyKey: recipient.idempotencyKey
    }));
    expect(value.emailCampaignRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: recipient.id, leaseOwner: expect.any(String) }),
      data: expect.objectContaining({
        deliveryStatus: EmailRecipientStatus.UNCERTAIN,
        failureCode: "PROVIDER_ACCEPTED_PERSISTENCE_FAILED",
        nextAttemptAt: null
      })
    }));
  });
});
