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
    clinicalDocumentTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({})
    }
  };
}


describe("DocumentsService clinical document templates", () => {
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

  it("creates structured template content", async () => {
    const prisma = createPrismaMock();
    prisma.clinicalDocumentTemplate.create.mockResolvedValue({
      id: "template-1",
      organizationId: "org-1",
      name: "Aviso",
      description: null,
      content: { version: "clinical-doc-blocks/v1", blocks: [{ id: "title", type: "title", text: "Aviso" }] },
      isActive: true
    });
    const service = new DocumentsService(prisma as never);

    await service.createClinicalDocumentTemplate(actor, {
      name: "Aviso",
      content: { blocks: [{ id: "title", type: "title", text: "Aviso" }] }
    } as never);

    expect(prisma.clinicalDocumentTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        content: { version: "clinical-doc-blocks/v1", blocks: [{ id: "title", type: "title", text: "Aviso" }] }
      })
    }));
  });

  it("duplicates a template with a unique copy name", async () => {
    const prisma = createPrismaMock();
    prisma.clinicalDocumentTemplate.findFirst
      .mockResolvedValueOnce({ id: "template-1", organizationId: "org-1", name: "Aviso", description: "Base", content: "Texto", isActive: true })
      .mockResolvedValueOnce(null);
    prisma.clinicalDocumentTemplate.create.mockResolvedValue({
      id: "template-2",
      organizationId: "org-1",
      name: "Copia de Aviso",
      description: "Base",
      content: { version: "clinical-doc-blocks/v1", blocks: [{ id: "legacy-text", type: "text", text: "Texto" }] },
      isActive: true
    });
    const service = new DocumentsService(prisma as never);

    const duplicated = await service.duplicateClinicalDocumentTemplate(actor, "template-1");

    expect(duplicated.name).toBe("Copia de Aviso");
    expect(prisma.clinicalDocumentTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Copia de Aviso", isActive: true })
    }));
  });
});

describe("DocumentsService binary upload validation", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["files.upload"]
  };

  it("rejects disguised content, persists an audit event and never creates file metadata", async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      fileAttachment: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" })
      }
    };
    const service = new DocumentsService(prisma as never);
    const buffer = Buffer.from("MZ executable", "ascii");

    await expect(
      service.uploadPatientBinaryFile(
        actor,
        "patient-1",
        {},
        {
          originalname: "consent.pdf",
          mimetype: "application/pdf",
          size: buffer.length,
          buffer
        }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "UNSUPPORTED_FILE_CONTENT" })
    });

    expect(prisma.fileAttachment.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        entity: "Patient",
        entityId: "patient-1",
        action: "upload_rejected",
        after: expect.objectContaining({ reasonCode: "SIGNATURE_MISMATCH" })
      })
    });
  });

  it("persists encrypted object metadata instead of writing a new legacy file", async () => {
    const buffer = Buffer.from("%PDF-1.7\nclinical", "ascii");
    const created = { id: "file-1", fileName: "stored.pdf", originalName: "consent.pdf", category: "DOCUMENT" };
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      fileAttachment: { create: jest.fn().mockResolvedValue(created) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const clinicalStorage = {
      store: jest.fn().mockResolvedValue({
        storageKey: "org-1/patients/patient-1/file-1.enc",
        storageProvider: "s3",
        checksumSha256: "a".repeat(64),
        scanStatus: "CLEAN",
        encryptionVersion: 1
      }),
      discard: jest.fn()
    };
    const service = new DocumentsService(prisma as never, clinicalStorage as never);

    await service.uploadPatientBinaryFile(actor, "patient-1", {}, {
      originalname: "consent.pdf",
      mimetype: "application/pdf",
      size: buffer.length,
      buffer
    });

    expect(clinicalStorage.store).toHaveBeenCalledWith(expect.objectContaining({ buffer, mimeType: "application/pdf" }));
    expect(prisma.fileAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageProvider: "s3",
        checksumSha256: "a".repeat(64),
        scanStatus: "CLEAN",
        encryptionVersion: 1,
        detectedMimeType: "application/pdf"
      })
    });
  });

  it("audits malware rejection and never creates metadata", async () => {
    const buffer = Buffer.from("%PDF-1.7\nEICAR", "ascii");
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" }) },
      fileAttachment: { create: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const clinicalStorage = {
      store: jest.fn().mockRejectedValue(new BadRequestException({ code: "MALWARE_DETECTED" }))
    };
    const service = new DocumentsService(prisma as never, clinicalStorage as never);

    await expect(service.uploadPatientBinaryFile(actor, "patient-1", {}, {
      originalname: "consent.pdf",
      mimetype: "application/pdf",
      size: buffer.length,
      buffer
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.fileAttachment.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "upload_rejected",
        after: expect.objectContaining({ reasonCode: "MALWARE_DETECTED" })
      })
    });
  });
});

describe("DocumentsService deletePatientFile isolation (SEC-01)", () => {
  const actorBranch1: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["patients.files.manage"]
  };

  it("throws NotFoundException when patient belongs to another branch", async () => {
    const prisma: any = {
      patient: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      fileAttachment: {
        findFirst: jest.fn(),
        updateMany: jest.fn()
      }
    };
    prisma.$transaction = jest.fn((cb: any) => cb(prisma));
    const service = new DocumentsService(prisma as never);

    await expect(
      service.deletePatientFile(actorBranch1, "patient-in-branch-2", "file-1", "Test reason")
    ).rejects.toThrow("Patient not found");

    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        branchId: { in: ["branch-1"] },
        deletedAt: null,
        id: "patient-in-branch-2"
      }
    });
  });

  it("throws NotFoundException when file belongs to another branch or does not exist", async () => {
    const txMock = {
      fileAttachment: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn()
      }
    };
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      $transaction: jest.fn((cb: any) => cb(txMock))
    };
    const service = new DocumentsService(prisma as never);

    await expect(
      service.deletePatientFile(actorBranch1, "patient-1", "file-in-branch-2", "Test reason")
    ).rejects.toThrow("File not found or already deleted");

    expect(txMock.fileAttachment.findFirst).toHaveBeenCalledWith({
      where: {
        id: "file-in-branch-2",
        patientId: "patient-1",
        organizationId: "org-1",
        patient: { branchId: { in: ["branch-1"] } },
        deletedAt: null
      }
    });
  });

  it("successfully soft-deletes file within user's branch scope in a transaction and audits", async () => {
    const fileMock = {
      id: "file-1",
      patientId: "patient-1",
      organizationId: "org-1",
      fileName: "doc.pdf"
    };
    const updatedFileMock = {
      ...fileMock,
      deletedAt: new Date(),
      deletedById: "user-1",
      deleteReason: "Patient request"
    };
    const txMock = {
      fileAttachment: {
        findFirst: jest.fn().mockResolvedValue(fileMock),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedFileMock)
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    };
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      $transaction: jest.fn((cb: any) => cb(txMock))
    };
    const service = new DocumentsService(prisma as never);

    const result = await service.deletePatientFile(actorBranch1, "patient-1", "file-1", "Patient request");

    expect(result).toEqual(updatedFileMock);
    expect(txMock.fileAttachment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "file-1",
        patientId: "patient-1",
        organizationId: "org-1",
        patient: { branchId: { in: ["branch-1"] } },
        deletedAt: null
      },
      data: expect.objectContaining({
        deletedById: "user-1",
        deleteReason: "Patient request"
      })
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        actorUserId: "user-1",
        entity: "FileAttachment",
        entityId: "file-1",
        action: "DELETE",
        before: fileMock,
        after: updatedFileMock
      }
    });
  });
});

