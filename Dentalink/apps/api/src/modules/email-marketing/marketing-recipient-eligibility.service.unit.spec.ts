import { MarketingConsentStatus, PatientStatus } from "@prisma/client";
import {
  MarketingRecipientEligibilityService,
  type EligibilityPatient
} from "./marketing-recipient-eligibility.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "CRM",
  roleIds: [],
  roleNames: [],
  permissions: ["integrations.communications.read"],
  branchIds: ["branch-1"]
};

const patient = (overrides: Partial<EligibilityPatient> = {}): EligibilityPatient => ({
  id: "patient-1",
  branchId: "branch-1",
  email: "patient@example.com",
  status: PatientStatus.ACTIVE,
  deletedAt: null,
  marketingConsent: MarketingConsentStatus.GRANTED,
  marketingUnsubscribedAt: null,
  ...overrides
});

describe("MarketingRecipientEligibilityService", () => {
  const prisma = {
    marketingSettings: {
      upsert: jest.fn().mockResolvedValue({ requireMarketingConsent: true, campaignCooldownDays: 30 })
    },
    emailSuppression: { findMany: jest.fn().mockResolvedValue([]) },
    emailCampaignRecipient: { findMany: jest.fn().mockResolvedValue([]) }
  };
  const service = new MarketingRecipientEligibilityService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketingSettings.upsert.mockResolvedValue({
      requireMarketingConsent: true,
      campaignCooldownDays: 30
    });
    prisma.emailSuppression.findMany.mockResolvedValue([]);
    prisma.emailCampaignRecipient.findMany.mockResolvedValue([]);
  });

  it("marks a valid consented patient as eligible", async () => {
    const [result] = await service.evaluateMany(actor, [patient()]);
    expect(result).toEqual(
      expect.objectContaining({ eligible: true, normalizedEmail: "patient@example.com", reasons: [] })
    );
  });

  it("rejects a patient without email", async () => {
    const [result] = await service.evaluateMany(actor, [patient({ email: null })]);
    expect(result.reasons.map((reason) => reason.code)).toContain("MISSING_EMAIL");
  });

  it("rejects malformed email", async () => {
    const [result] = await service.evaluateMany(actor, [patient({ email: "not-an-email" })]);
    expect(result.reasons.map((reason) => reason.code)).toContain("INVALID_EMAIL");
  });

  it("rejects missing marketing consent", async () => {
    const [result] = await service.evaluateMany(actor, [
      patient({ marketingConsent: MarketingConsentStatus.UNKNOWN })
    ]);
    expect(result.reasons.map((reason) => reason.code)).toContain("NO_MARKETING_CONSENT");
  });

  it("rejects an unsubscribed patient", async () => {
    const [result] = await service.evaluateMany(actor, [
      patient({ marketingConsent: MarketingConsentStatus.UNSUBSCRIBED, marketingUnsubscribedAt: new Date() })
    ]);
    expect(result.reasons.map((reason) => reason.code)).toContain("UNSUBSCRIBED");
  });

  it("rejects a prior hard bounce", async () => {
    prisma.emailSuppression.findMany.mockResolvedValue([
      { normalizedEmail: "patient@example.com", reason: "HARD_BOUNCE" }
    ]);
    const [result] = await service.evaluateMany(actor, [patient()]);
    expect(result.reasons.map((reason) => reason.code)).toContain("HARD_BOUNCE");
  });

  it("rejects a recently contacted email", async () => {
    prisma.emailCampaignRecipient.findMany.mockResolvedValue([
      { normalizedEmail: "patient@example.com", sentAt: new Date() }
    ]);
    const [result] = await service.evaluateMany(actor, [patient()]);
    expect(result.reasons.map((reason) => reason.code)).toContain("RECENTLY_CONTACTED");
  });

  it("deduplicates the same normalized email across patients", async () => {
    const results = await service.evaluateMany(actor, [
      patient(),
      patient({ id: "patient-2", email: " PATIENT@example.com " })
    ]);
    expect(results[0].eligible).toBe(true);
    expect(results[1].reasons.map((reason) => reason.code)).toContain("DUPLICATED_EMAIL");
  });

  it("rejects inactive and out-of-scope patients", async () => {
    const [result] = await service.evaluateMany(actor, [
      patient({ status: PatientStatus.INACTIVE, branchId: "branch-2" })
    ]);
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["INACTIVE_PATIENT", "OUT_OF_SCOPE"])
    );
  });

  it("uses the organization policy instead of hardcoding consent rules", async () => {
    prisma.marketingSettings.upsert.mockResolvedValue({
      requireMarketingConsent: false,
      campaignCooldownDays: 30
    });
    const [result] = await service.evaluateMany(actor, [
      patient({ marketingConsent: MarketingConsentStatus.UNKNOWN })
    ]);
    expect(result.eligible).toBe(true);
  });

  it("uses only the registered email for the treated-patient report", async () => {
    prisma.emailSuppression.findMany.mockResolvedValue([
      { normalizedEmail: "patient@example.com", reason: "HARD_BOUNCE" }
    ]);
    const [result] = await service.evaluateMany(
      actor,
      [
        patient({
          branchId: "branch-2",
          status: PatientStatus.INACTIVE,
          marketingConsent: MarketingConsentStatus.UNKNOWN
        })
      ],
      undefined,
      "REGISTERED_EMAIL_ONLY"
    );

    expect(result).toEqual(
      expect.objectContaining({
        eligible: true,
        normalizedEmail: "patient@example.com",
        reasons: []
      })
    );
    expect(prisma.marketingSettings.upsert).not.toHaveBeenCalled();
    expect(prisma.emailSuppression.findMany).not.toHaveBeenCalled();
    expect(prisma.emailCampaignRecipient.findMany).not.toHaveBeenCalled();
  });
});
