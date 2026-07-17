import { BadRequestException } from "@nestjs/common";
import { AppointmentStatus, ProfessionalBranchStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { ClinicalService } from "./clinical.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "user@example.com",
  firstName: "User",
  lastName: "One",
  roleIds: [],
  roleNames: [],
  branchIds: ["branch-1"],
  permissions: []
};

describe("ClinicalService professional branch validation", () => {
  it("rejects clinical records with a professional outside the patient branch", async () => {
    const prisma: any = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      professional: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new ClinicalService(prisma as never);

    await expect(
      service.createEvolution(actor, "patient-1", {
        professionalId: "professional-2"
      } as never)
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "professional-2",
          organizationId: "org-1",
          isActive: true,
          branches: {
            some: expect.objectContaining({
              branchId: "branch-1",
              status: ProfessionalBranchStatus.ACTIVE
            })
          }
        })
      })
    );
  });

  it("returns created evolutions with the relations required by the timeline", async () => {
    const createdEvolution = {
      id: "evolution-1",
      patientId: "patient-1",
      professionalId: "professional-1",
      professional: { id: "professional-1", firstName: "Andrea", lastName: "Silva" },
      fields: [],
      materials: [],
      addenda: []
    };
    const prisma: any = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      professional: {
        findFirst: jest.fn().mockResolvedValue({ id: "professional-1" })
      },
      clinicalEvolution: {
        create: jest.fn().mockResolvedValue(createdEvolution)
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };
    prisma.$transaction = jest.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    const service = new ClinicalService(prisma as never);

    await expect(
      service.createEvolution(actor, "patient-1", {
        professionalId: "professional-1",
        notes: "Control clinico"
      } as never)
    ).resolves.toEqual(createdEvolution);

    expect(prisma.clinicalEvolution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          professional: true,
          fields: { orderBy: { sortOrder: "asc" } },
          materials: { include: { inventoryItem: true } },
          addenda: { orderBy: { createdAt: "asc" } }
        })
      })
    );
  });
});


describe("ClinicalService clinical documents", () => {
  it("lists only non-deleted patient documents and normalizes legacy content", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      clinicalDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "doc-1",
            patientId: "patient-1",
            title: "Aviso",
            content: "Texto legado",
            status: "DRAFT",
            createdAt: new Date("2026-07-02T00:00:00.000Z"),
            template: null
          }
        ])
      }
    };
    const service = new ClinicalService(prisma as never);

    const result = await service.listDocuments(actor, "patient-1");

    expect(prisma.clinicalDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: "patient-1", deletedAt: null } }));
    expect(result[0].content).toEqual({ version: "clinical-doc-blocks/v1", blocks: [{ id: "legacy-text", type: "text", text: "Texto legado" }] });
  });

  it("rejects documents that reference templates from another organization", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      clinicalDocumentTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      clinicalDocument: { create: jest.fn() }
    };
    const service = new ClinicalService(prisma as never);

    await expect(
      service.createDocument(actor, "patient-1", {
        templateId: "template-other-org",
        title: "Documento",
        content: { blocks: [] }
      } as never)
    ).rejects.toThrow("Clinical document template not found");

    expect(prisma.clinicalDocument.create).not.toHaveBeenCalled();
  });
});

describe("ClinicalService patient history", () => {
  function historyPrisma(overrides: Record<string, unknown> = {}) {
    const emptyFindMany = jest.fn().mockResolvedValue([]);
    return {
      patient: {
        findFirst: jest.fn().mockResolvedValue({
          id: "patient-1",
          branchId: "branch-1",
          firstName: "Ana",
          lastName: "Lopez",
          documentType: "CURP",
          documentNumber: "ABC123",
          birthDate: null,
          phone: "555",
          email: "ana@example.com",
          createdAt: new Date("2026-07-01T10:00:00.000Z")
        })
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: "org-1", name: "Dental+", legalName: null, logoUrl: "logo.png", phone: null, email: null, address: null })
      },
      appointment: { findMany: emptyFindMany },
      treatmentPlan: { findMany: emptyFindMany },
      budget: { findMany: emptyFindMany },
      clinicalEvolution: { findMany: emptyFindMany },
      odontogramRecord: { findMany: emptyFindMany },
      toothProcedure: { findMany: emptyFindMany },
      periodontalChart: { findMany: emptyFindMany },
      medicalHistory: { findUnique: jest.fn().mockResolvedValue(null) },
      medicalCondition: { findMany: emptyFindMany },
      allergy: { findMany: emptyFindMany },
      medication: { findMany: emptyFindMany },
      patientMedicalAlert: { findMany: emptyFindMany },
      clinicalDocument: { findMany: emptyFindMany },
      prescription: { findMany: emptyFindMany },
      labOrder: { findMany: emptyFindMany },
      consent: { findMany: emptyFindMany },
      ...overrides
    } as any;
  }

  it("returns an integral timeline from backend sources and excludes annulled events by default", async () => {
    const appointmentRows = [
      {
        id: "appointment-active",
        title: "Consulta",
        reason: "Valoracion",
        status: AppointmentStatus.SCHEDULED,
        startAt: new Date("2026-07-15T16:00:00.000Z"),
        endAt: new Date("2026-07-15T16:30:00.000Z"),
        createdAt: new Date("2026-07-10T12:00:00.000Z"),
        treatmentPlanId: null,
        cancellationReason: null,
        branch: { id: "branch-1", name: "Centro", phone: null, address: null, brand: null },
        professional: { id: "professional-1", firstName: "Luisa", lastName: "Mora" },
        specialty: null,
        createdBy: { id: "user-1", firstName: "User", lastName: "One" },
        updatedBy: null,
        statusHistory: [],
        reminders: [],
        communicationJobs: []
      },
      {
        id: "appointment-cancelled",
        title: "Control",
        reason: "Cancelada",
        status: AppointmentStatus.CANCELLED_BY_PATIENT,
        startAt: new Date("2026-07-14T16:00:00.000Z"),
        endAt: new Date("2026-07-14T16:30:00.000Z"),
        createdAt: new Date("2026-07-10T11:00:00.000Z"),
        treatmentPlanId: null,
        cancellationReason: "Paciente no puede asistir",
        branch: { id: "branch-1", name: "Centro", phone: null, address: null, brand: null },
        professional: { id: "professional-1", firstName: "Luisa", lastName: "Mora" },
        specialty: null,
        createdBy: { id: "user-1", firstName: "User", lastName: "One" },
        updatedBy: null,
        statusHistory: [],
        reminders: [],
        communicationJobs: []
      }
    ];
    const prisma = historyPrisma({ appointment: { findMany: jest.fn().mockResolvedValue(appointmentRows) } });
    const service = new ClinicalService(prisma as never);

    const result = await service.listPatientHistory(actor, "patient-1", { categories: "APPOINTMENTS" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sourceEntityType: "Appointment",
      sourceEntityId: "appointment-active",
      category: "APPOINTMENTS",
      isAnnulled: false
    });
  });
});

describe("ClinicalService odontogram surfaces", () => {
  it("creates tooth diagnoses with normalized surface", async () => {
    const tx = {
      odontogramRecord: {
        create: jest.fn().mockResolvedValue({ id: "record-1", toothNumber: "18", surface: "D" })
      },
      toothCondition: {
        create: jest.fn().mockResolvedValue({ id: "condition-1", toothNumber: "18", surface: "D" })
      }
    };
    const prisma: any = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      $transaction: jest.fn((callback: (transactionClient: typeof tx) => unknown) => callback(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const service = new ClinicalService(prisma as never);

    await service.createToothCondition(actor, "patient-1", {
      professionalId: "professional-1",
      toothNumber: "18",
      surface: "d",
      condition: "Caries",
      diagnosis: "Caries distal"
    });

    expect(tx.odontogramRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toothNumber: "18", surface: "D" })
      })
    );
    expect(tx.toothCondition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toothNumber: "18", surface: "D" })
      })
    );
  });

  it("normalizes multi-surface tooth diagnoses", async () => {
    const tx = {
      odontogramRecord: {
        create: jest.fn().mockResolvedValue({ id: "record-1", toothNumber: "18", surface: "M,D" })
      },
      toothCondition: {
        create: jest.fn().mockResolvedValue({ id: "condition-1", toothNumber: "18", surface: "M,D" })
      }
    };
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      $transaction: jest.fn((callback: (transactionClient: typeof tx) => unknown) => callback(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const service = new ClinicalService(prisma as never);

    await service.createToothCondition(actor, "patient-1", {
      professionalId: "professional-1",
      toothNumber: "18",
      surface: "D,M",
      condition: "Caries",
      diagnosis: "Caries mesial distal"
    });

    expect(tx.odontogramRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toothNumber: "18", surface: "M,D" })
      })
    );
    expect(tx.toothCondition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toothNumber: "18", surface: "M,D" })
      })
    );
  });

  it("rejects invalid tooth surfaces before creating odontogram rows", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      professional: { findFirst: jest.fn().mockResolvedValue({ id: "professional-1" }) },
      $transaction: jest.fn(),
      auditLog: { create: jest.fn() }
    };
    const service = new ClinicalService(prisma as never);

    await expect(
      service.createToothCondition(actor, "patient-1", {
        professionalId: "professional-1",
        toothNumber: "18",
        surface: "XYZ",
        condition: "Caries"
      } as never)
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("filters tooth history by tooth and surface", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      odontogramRecord: { findMany: jest.fn().mockResolvedValue([]) },
      toothCondition: { findMany: jest.fn().mockResolvedValue([]) },
      toothProcedure: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new ClinicalService(prisma as never);

    const result = await service.getToothHistory(actor, "patient-1", "18", "d");

    expect(result.surface).toBe("D");
    expect(prisma.odontogramRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: "patient-1", toothNumber: "18", surface: "D" }) })
    );
    expect(prisma.toothCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: "patient-1", toothNumber: "18", surface: "D" }) })
    );
    expect(prisma.toothProcedure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: "patient-1", toothNumber: "18", surface: "D" }) })
    );
  });
});
