import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { DocumentsService } from "./documents.service";

describe("DocumentsService radiography analysis", () => {
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

  it("returns null when an XRAY image has no saved analysis", async () => {
    const prisma = createPrismaMock();
    prisma.radiographyAnalysis.findUnique.mockResolvedValue(null);
    const service = new DocumentsService(prisma as never);

    await expect(service.getPatientRadiographyAnalysis(actor, "patient-1", "file-1")).resolves.toBeNull();

    expect(prisma.fileAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "file-1",
          organizationId: "org-1",
          patientId: "patient-1",
          patient: { branchId: { in: ["branch-1"] } }
        })
      })
    );
  });

  it("upserts manual findings and normalizes coordinates", async () => {
    const prisma = createPrismaMock();
    prisma.radiographyAnalysis.upsert.mockResolvedValue({
      id: "analysis-1",
      organizationId: "org-1",
      patientId: "patient-1",
      fileAttachmentId: "file-1",
      provider: "MANUAL",
      status: "DRAFT",
      findings: [
        {
          id: "finding-1",
          tooth: "1.6",
          label: "Implante",
          bbox: { x: 0.9, y: 0.1, width: 0.1, height: 0.2 },
          visible: true,
          source: "MANUAL"
        }
      ],
      createdById: "user-1",
      updatedById: "user-1",
      createdAt: new Date("2026-06-08T18:00:00.000Z"),
      updatedAt: new Date("2026-06-08T18:00:00.000Z")
    });
    const service = new DocumentsService(prisma as never);

    const saved = await service.upsertPatientRadiographyAnalysis(actor, "patient-1", "file-1", {
      findings: [
        {
          id: "finding-1",
          tooth: " 1.6 ",
          label: " Implante ",
          bbox: { x: 0.9, y: 0.1, width: 0.4, height: 0.2 },
          visible: true,
          source: "AI"
        }
      ]
    });

    expect(saved.findings).toHaveLength(1);
    expect(prisma.radiographyAnalysis.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fileAttachmentId: "file-1" },
        create: expect.objectContaining({
          provider: "MANUAL",
          findings: [
            expect.objectContaining({
              tooth: "1.6",
              label: "Implante",
              bbox: { x: 0.9, y: 0.1, width: 0.09999999999999998, height: 0.2 },
              source: "MANUAL"
            })
          ],
          createdById: "user-1",
          updatedById: "user-1"
        }),
        update: expect.objectContaining({
          provider: "MANUAL",
          updatedById: "user-1"
        })
      })
    );
  });

  it("rejects non-XRAY files", async () => {
    const prisma = createPrismaMock();
    prisma.fileAttachment.findFirst.mockResolvedValue({
      id: "file-1",
      organizationId: "org-1",
      patientId: "patient-1",
      category: "DOCUMENT",
      mimeType: "application/pdf"
    });
    const service = new DocumentsService(prisma as never);

    await expect(
      service.upsertPatientRadiographyAnalysis(actor, "patient-1", "file-1", { findings: [] })
    ).rejects.toThrow(BadRequestException);
  });
});

function createPrismaMock() {
  return {
    patient: {
      findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
    },
    fileAttachment: {
      findFirst: jest.fn().mockResolvedValue({
        id: "file-1",
        organizationId: "org-1",
        patientId: "patient-1",
        category: "XRAY",
        mimeType: "image/jpeg"
      })
    },
    radiographyAnalysis: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({})
    }
  };
}
