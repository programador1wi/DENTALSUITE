import { BadRequestException } from "@nestjs/common";
import { ProfessionalBranchStatus } from "@prisma/client";
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
    const prisma = {
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
    const prisma = {
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
