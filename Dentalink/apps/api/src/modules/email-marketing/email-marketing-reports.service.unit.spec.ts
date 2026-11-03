import { MarketingConsentStatus, PatientStatus } from "@prisma/client";
import { EmailMarketingReportsService } from "./email-marketing-reports.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "CRM",
  roleIds: [],
  roleNames: [],
  permissions: [],
  branchIds: ["branch-1"]
};

describe("EmailMarketingReportsService", () => {
  const patient = {
    id: "patient-1",
    branchId: "branch-1",
    firstName: "Eduardo",
    lastName: "Chanona",
    documentNumber: "DOC-1",
    email: "eduardo@example.com",
    phone: "5551234567",
    birthDate: null,
    status: PatientStatus.ACTIVE,
    marketingConsent: MarketingConsentStatus.GRANTED,
    marketingUnsubscribedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    branch: { id: "branch-1", name: "León Valle" },
    agreement: null,
    appointments: [],
    budgets: [],
    collectionCases: []
  };
  const prisma = {
    patient: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([patient])
    },
    professional: {
      findFirst: jest.fn().mockResolvedValue({
        id: "professional-1",
        firstName: "TET",
        lastName: "TEST"
      })
    },
    clinicalEvolution: {
      groupBy: jest.fn().mockResolvedValue([
        {
          patientId: "patient-1",
          _max: { createdAt: new Date("2026-07-20T23:10:11.943Z") }
        }
      ])
    },
    appointment: {
      groupBy: jest.fn().mockResolvedValue([
        {
          patientId: "patient-1",
          _max: { startAt: new Date("2026-07-19T12:00:00.000Z") }
        }
      ])
    }
  };
  const eligibility = {
    evaluateMany: jest.fn().mockResolvedValue([{ patientId: "patient-1", eligible: true, reasons: [] }])
  };
  const service = new EmailMarketingReportsService(prisma as never, eligibility as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("finds treated patients from clinical evolutions and attended appointments", async () => {
    const response = await service.preview(actor, "PATIENTS_TREATED_BY_PROFESSIONAL", {
      parameters: {
        professionalId: "professional-1",
        branchId: "branch-1"
      },
      page: 1,
      pageSize: 50
    });

    expect(prisma.patient.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: "org-1",
        email: { not: null },
        NOT: { email: "" },
        OR: [
          {
            clinicalEvolutions: {
              some: { professionalId: "professional-1", annulledAt: null }
            }
          },
          {
            appointments: {
              some: {
                professionalId: "professional-1",
                status: { in: ["ARRIVED", "WAITING_ROOM", "IN_PROGRESS", "COMPLETED"] }
              }
            }
          }
        ]
      })
    });
    expect(prisma.patient.count).toHaveBeenCalledWith({
      where: expect.not.objectContaining({ branchId: expect.anything() })
    });
    expect(eligibility.evaluateMany).toHaveBeenCalledWith(
      actor,
      [patient],
      undefined,
      "REGISTERED_EMAIL_ONLY"
    );
    expect(response.items[0]).toEqual(
      expect.objectContaining({
        patientId: "patient-1",
        professional: "TET TEST",
        professionalId: "professional-1",
        lastAttentionAt: new Date("2026-07-20T23:10:11.943Z")
      })
    );
  });

  it("revalidates selected treated patients by professional and email without branch scope", async () => {
    await service.selectedPatients(actor, ["patient-1"], {
      reportCode: "PATIENTS_TREATED_BY_PROFESSIONAL",
      parameters: { professionalId: "professional-1" }
    });

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          email: { not: null },
          OR: expect.arrayContaining([
            {
              clinicalEvolutions: {
                some: { professionalId: "professional-1", annulledAt: null }
              }
            }
          ])
        })
      })
    );
    expect(eligibility.evaluateMany).toHaveBeenCalledWith(
      actor,
      [patient],
      undefined,
      "REGISTERED_EMAIL_ONLY"
    );
  });

  it("exports every report page instead of truncating at the backend page-size cap", async () => {
    const rows = Array.from({ length: 250 }, (_, index) => ({ patientId: `patient-${index + 1}` }));
    const previewSpy = jest.spyOn(service, "preview").mockImplementation(async (_actor, _code, dto) => {
      const page = dto.page ?? 1;
      const pageSize = 100;
      return {
        report: { code: "ALL_PATIENTS" },
        parameters: dto.parameters,
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: rows.length, hasMore: page * pageSize < rows.length },
        summary: { results: rows.length, visible: pageSize, eligible: pageSize, ineligible: 0 }
      } as never;
    });

    const exported = await service.exportRows(actor, "ALL_PATIENTS", { parameters: {} });

    expect(exported).toHaveLength(250);
    expect(previewSpy).toHaveBeenCalledTimes(3);
    expect(previewSpy.mock.calls.map((call) => call[2].pageSize)).toEqual([100, 100, 100]);
    previewSpy.mockRestore();
  });
});
