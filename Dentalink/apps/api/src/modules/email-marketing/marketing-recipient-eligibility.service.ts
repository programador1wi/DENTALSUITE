import { Injectable } from "@nestjs/common";
import { EmailRecipientStatus, MarketingConsentStatus, PatientStatus } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";

export type EligibilityReasonCode =
  | "INVALID_EMAIL"
  | "MISSING_EMAIL"
  | "NO_MARKETING_CONSENT"
  | "UNSUBSCRIBED"
  | "HARD_BOUNCE"
  | "SPAM_COMPLAINT"
  | "SUPPRESSED"
  | "RECENTLY_CONTACTED"
  | "ALREADY_INCLUDED_IN_PERIOD"
  | "DUPLICATED_EMAIL"
  | "INACTIVE_PATIENT"
  | "OUT_OF_SCOPE";

export type EligibilityReason = { code: EligibilityReasonCode; label: string };

export type EligibilityPatient = {
  id: string;
  branchId: string;
  email: string | null;
  status: PatientStatus;
  deletedAt: Date | null;
  marketingConsent: MarketingConsentStatus;
  marketingUnsubscribedAt: Date | null;
};

export type EligibilityResult = {
  patientId: string;
  normalizedEmail: string | null;
  eligible: boolean;
  reasons: EligibilityReason[];
};

export type MarketingEligibilityPolicy = "MARKETING_DEFAULT" | "REGISTERED_EMAIL_ONLY";

const EMAIL_REGEX = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const labels: Record<EligibilityReasonCode, string> = {
  INVALID_EMAIL: "Correo electrónico no válido",
  MISSING_EMAIL: "Paciente sin correo electrónico",
  NO_MARKETING_CONSENT: "Sin consentimiento para marketing",
  UNSUBSCRIBED: "Paciente dado de baja de marketing",
  HARD_BOUNCE: "Correo suprimido por rebote permanente",
  SPAM_COMPLAINT: "Correo suprimido por denuncia de spam",
  SUPPRESSED: "Correo incluido en la lista de supresión",
  RECENTLY_CONTACTED: "Contactado dentro del periodo restringido",
  ALREADY_INCLUDED_IN_PERIOD: "Ya fue incluido en una campaña durante el periodo restringido",
  DUPLICATED_EMAIL: "Correo duplicado en otro paciente del resultado",
  INACTIVE_PATIENT: "Paciente inactivo o deshabilitado",
  OUT_OF_SCOPE: "Paciente fuera del alcance autorizado"
};

@Injectable()
export class MarketingRecipientEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateMany(
    actor: AuthUser,
    patients: EligibilityPatient[],
    excludeCampaignId?: string,
    policy: MarketingEligibilityPolicy = "MARKETING_DEFAULT"
  ): Promise<EligibilityResult[]> {
    const normalized = patients.map((patient) => this.normalizeEmail(patient.email));

    if (policy === "REGISTERED_EMAIL_ONLY") {
      return patients.map((patient, index) => {
        const email = normalized[index];
        const reasons: EligibilityReason[] = [];
        if (!email) {
          const code: EligibilityReasonCode = patient.email?.trim() ? "INVALID_EMAIL" : "MISSING_EMAIL";
          reasons.push({ code, label: labels[code] });
        }
        return {
          patientId: patient.id,
          normalizedEmail: email,
          eligible: reasons.length === 0,
          reasons
        };
      });
    }

    const settings = await this.prisma.marketingSettings.upsert({
      where: { organizationId: actor.organizationId },
      create: { organizationId: actor.organizationId },
      update: {}
    });
    const emails = [...new Set(normalized.filter((value): value is string => Boolean(value)))];
    const cooldownStart = new Date(Date.now() - settings.campaignCooldownDays * 24 * 60 * 60 * 1000);
    const [suppressions, recentRecipients] = await Promise.all([
      emails.length
        ? this.prisma.emailSuppression.findMany({
            where: {
              organizationId: actor.organizationId,
              normalizedEmail: { in: emails },
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            }
          })
        : [],
      emails.length && settings.campaignCooldownDays > 0
        ? this.prisma.emailCampaignRecipient.findMany({
            where: {
              normalizedEmail: { in: emails },
              selectedAt: { gte: cooldownStart },
              campaign: {
                organizationId: actor.organizationId,
                status: { notIn: ["CANCELLED", "ARCHIVED"] },
                ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {})
              },
              deliveryStatus: { not: EmailRecipientStatus.ELIGIBILITY_REJECTED }
            },
            select: { normalizedEmail: true, sentAt: true }
          })
        : []
    ]);
    const suppressionByEmail = new Map(suppressions.map((item) => [item.normalizedEmail, item]));
    const recentByEmail = new Map(recentRecipients.map((item) => [item.normalizedEmail, item]));
    const seen = new Set<string>();

    return patients.map((patient, index) => {
      const email = normalized[index];
      const reasons: EligibilityReason[] = [];
      const add = (code: EligibilityReasonCode) => reasons.push({ code, label: labels[code] });

      if (!actor.branchIds.includes(patient.branchId)) add("OUT_OF_SCOPE");
      if (
        patient.deletedAt ||
        !([PatientStatus.NEW, PatientStatus.ACTIVE, PatientStatus.IN_TREATMENT] as PatientStatus[]).includes(
          patient.status
        )
      ) {
        add("INACTIVE_PATIENT");
      }
      if (!email) add(patient.email?.trim() ? "INVALID_EMAIL" : "MISSING_EMAIL");
      if (
        patient.marketingUnsubscribedAt ||
        patient.marketingConsent === MarketingConsentStatus.UNSUBSCRIBED
      ) {
        add("UNSUBSCRIBED");
      } else if (
        settings.requireMarketingConsent &&
        patient.marketingConsent !== MarketingConsentStatus.GRANTED
      ) {
        add("NO_MARKETING_CONSENT");
      } else if (patient.marketingConsent === MarketingConsentStatus.DENIED) {
        add("NO_MARKETING_CONSENT");
      }

      if (email) {
        const suppression = suppressionByEmail.get(email);
        if (suppression?.reason === "HARD_BOUNCE") add("HARD_BOUNCE");
        else if (suppression?.reason === "SPAM_COMPLAINT") add("SPAM_COMPLAINT");
        else if (suppression) add("SUPPRESSED");

        const recent = recentByEmail.get(email);
        if (recent) add(recent.sentAt ? "RECENTLY_CONTACTED" : "ALREADY_INCLUDED_IN_PERIOD");
        if (seen.has(email)) add("DUPLICATED_EMAIL");
        seen.add(email);
      }

      return { patientId: patient.id, normalizedEmail: email, eligible: reasons.length === 0, reasons };
    });
  }

  normalizeEmail(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized || /[\r\n]/.test(normalized) || !EMAIL_REGEX.test(normalized)) return null;
    return normalized;
  }
}
