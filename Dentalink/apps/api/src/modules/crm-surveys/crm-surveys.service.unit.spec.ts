import { ConflictException } from "@nestjs/common";
import {
  CommunicationChannel,
  MarketingConsentStatus,
  SurveyDefinitionStatus,
  SurveyInvitationStatus,
  SurveyQuestionType,
  SurveyType,
  SurveyVersionStatus
} from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { CrmSurveysService } from "./crm-surveys.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Dental",
  roleIds: [],
  roleNames: [],
  branchIds: ["branch-1"],
  permissions: ["integrations.surveys.read", "integrations.surveys.manage"]
};

function buildService(prisma: Record<string, unknown> = {}) {
  return new CrmSurveysService(
    prisma as never,
    { get: jest.fn((key: string) => key === "FRONTEND_URL" ? "http://localhost:3000" : undefined) } as never
  );
}

function draftSurvey(overrides: Record<string, unknown> = {}) {
  const { draftVersion: draftVersionOverrides, ...surveyOverrides } = overrides;
  const draftVersion = {
    id: "version-1",
    version: 1,
    status: SurveyVersionStatus.DRAFT,
    emailSubject: "Tu opinión nos interesa",
    emailHeaderHtml: "Hola {nombrePaciente}",
    emailFooterHtml: "Gracias",
    sections: [],
    ...((draftVersionOverrides as Record<string, unknown>) ?? {})
  };
  return {
    id: "survey-1",
    organizationId: "org-1",
    branchId: "branch-1",
    name: "Encuesta de atención",
    type: SurveyType.SATISFACTION,
    channel: CommunicationChannel.EMAIL,
    status: SurveyDefinitionStatus.DRAFT,
    activeVersionId: null,
    ...surveyOverrides,
    versions: [draftVersion],
    draftVersion,
    activeVersion: null,
    editorVersion: draftVersion,
    invitationCount: 0,
    responseCount: 0
  };
}

describe("CrmSurveysService", () => {
  it("creates a draft definition and its first version immediately", async () => {
    const tx = {
      surveyDefinition: { create: jest.fn().mockResolvedValue({ id: "survey-1", type: SurveyType.SATISFACTION, branchId: null }) },
      auditLog: { create: jest.fn() }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = buildService(prisma);
    jest.spyOn(service, "get").mockResolvedValue(draftSurvey() as never);

    await service.create(actor, {});

    expect(tx.surveyDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Encuesta sin nombre",
        createdById: actor.id,
        versions: { create: { version: 1 } }
      })
    }));
  });

  it("rejects activation when the draft has no sections or questions", async () => {
    const service = buildService();
    jest.spyOn(service, "get").mockResolvedValue(draftSurvey() as never);

    await expect(service.activate(actor, "survey-1")).rejects.toThrow("Agrega al menos una sección");
  });

  it("publishes a complete draft and freezes the previous active version", async () => {
    const complete = draftSurvey({
      status: SurveyDefinitionStatus.ACTIVE,
      activeVersionId: "version-0",
      draftVersion: {
        sections: [{
          id: "section-1",
          questions: [{ id: "question-1", text: "¿Cómo fue tu atención?", type: SurveyQuestionType.LIKERT_5, options: [{ id: "option-1", label: "Excelente" }] }]
        }]
      }
    });
    const tx = {
      surveyDefinition: { updateMany: jest.fn(), update: jest.fn() },
      surveyVersion: { update: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = buildService(prisma);
    jest.spyOn(service, "get").mockResolvedValueOnce(complete as never).mockResolvedValueOnce(complete as never);

    await service.activate(actor, "survey-1");

    expect(tx.surveyVersion.update).toHaveBeenCalledWith({ where: { id: "version-0" }, data: { status: SurveyVersionStatus.SUPERSEDED } });
    expect(tx.surveyVersion.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "version-1" },
      data: expect.objectContaining({ status: SurveyVersionStatus.PUBLISHED, publishedById: actor.id })
    }));
  });

  it("does not allow a published section to be edited in place", async () => {
    const prisma = { surveySection: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = buildService(prisma);

    await expect(service.updateSection(actor, "section-published", { name: "Cambio" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("escapes patient variables when rendering email content", () => {
    const service = buildService();
    expect(service.renderVariables("Hola {nombrePaciente}", { nombrePaciente: "<img onerror=alert(1)>" }))
      .toBe("Hola &lt;img onerror=alert(1)&gt;");
  });

  it("creates only one invitation candidate for an attended appointment", async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "appointment-1",
          organizationId: "org-1",
          branchId: "branch-1",
          patientId: "patient-1",
          professionalId: "professional-1",
          status: "COMPLETED",
          patient: { id: "patient-1", email: "patient@example.com", marketingConsent: MarketingConsentStatus.GRANTED },
          professional: { specialties: [{ specialtyId: "specialty-1" }] },
          branch: { timezone: "America/Mexico_City" }
        })
      },
      surveySendConfiguration: {
        findMany: jest.fn().mockResolvedValue([{
          id: "config-1",
          updatedById: "user-1",
          branchIds: [],
          professionalIds: [],
          specialtyIds: [],
          requireConsent: true,
          minimumFrequencyDays: 30,
          delayMinutes: 120,
          survey: { id: "survey-1", branchId: null, activeVersionId: "version-1" }
        }])
      },
      surveyInvitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "invitation-1" })
      },
      auditLog: { create: jest.fn() }
    };
    const service = buildService(prisma);

    await expect(service.handleAppointmentCompleted("appointment-1")).resolves.toEqual({ created: 1, skipped: 0 });
    expect(prisma.surveyInvitation.create).toHaveBeenCalledTimes(1);
    expect(prisma.surveyInvitation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ appointmentId: "appointment-1", surveyVersionId: "version-1", recipientEmail: "patient@example.com" })
    }));
  });

  it("rejects a second response for the same invitation token", async () => {
    const service = buildService();
    jest.spyOn(service as never, "resolveInvitation" as never).mockResolvedValue({
      status: SurveyInvitationStatus.RESPONDED,
      tokenExpiresAt: new Date(Date.now() + 60_000)
    } as never);

    await expect(service.submitPublicSurvey("a".repeat(40), { answers: [] })).rejects.toThrow("ya fue respondida");
  });

  it("calculates NPS exclusively from NPS_10 answers", async () => {
    const invitationCount = jest.fn()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const prisma = {
      surveyInvitation: { count: invitationCount },
      surveyResponse: { count: jest.fn().mockResolvedValue(4) },
      surveyAnswer: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { valueNumber: 7.5 } }),
        findMany: jest.fn().mockResolvedValue([{ valueNumber: 10 }, { valueNumber: 9 }, { valueNumber: 8 }, { valueNumber: 4 }])
      },
      surveyQuestion: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = buildService(prisma);

    const report = await service.results(actor, {});

    expect(report.metrics).toEqual(expect.objectContaining({ promoters: 2, passives: 1, detractors: 1, nps: 25 }));
  });

  it("hashes public tokens instead of persisting the raw value", () => {
    const service = buildService();
    const raw = "sensitive-public-token";
    const hash = service.hashToken(raw);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(raw);
    expect(service.hashToken(raw)).toBe(hash);
  });
});
