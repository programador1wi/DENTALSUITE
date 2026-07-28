import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConsentStatus, ConsentTemplateStatus, ConsentTemplateVersionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthUser } from "../../../common/types/auth-user";
import { ConsentsService } from "./consents.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "user@example.com",
  firstName: "User",
  lastName: "One",
  roleIds: [],
  roleNames: [],
  branchIds: ["branch-1"],
  permissions: [
    "consents.templates.publish",
    "consents.instances.create",
    "consents.instances.sign_patient"
  ]
};

describe("ConsentsService security and lifecycle", () => {
  it("blocks publication when structural validation fails", async () => {
    const prisma = mockPrisma();
    prisma.consentTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      organizationId: "org-1",
      version: 1,
      status: ConsentTemplateStatus.DRAFT,
      versions: [
        {
          id: "version-1",
          versionNumber: 1,
          status: ConsentTemplateVersionStatus.DRAFT,
          editorSchemaJson: { type: "doc", content: [] },
          requiredSignersJson: {
            patient: { enabled: false, required: false },
            professional: { enabled: false, required: false, mode: "ANY_AUTHORIZED" },
            representative: { enabled: false, required: false, replacesPatient: false }
          }
        }
      ]
    });
    const service = new ConsentsService(prisma as never);

    await expect(service.publishTemplate(actor, "template-1", { expectedVersion: 1 })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("enforces tenant and branch ownership on consent reads", async () => {
    const prisma = mockPrisma();
    prisma.consent.findFirst.mockResolvedValue(null);
    const service = new ConsentsService(prisma as never);

    await expect(service.getConsent(actor, "consent-other-tenant")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consent-other-tenant",
          organizationId: "org-1",
          branchId: { in: ["branch-1"] }
        }
      })
    );
  });

  it("rejects reuse of an idempotency key with a different patient", async () => {
    const prisma = mockPrisma();
    prisma.consent.findUnique.mockResolvedValue({
      patientId: "patient-2",
      templateId: "template-1",
      treatmentPlanId: null,
      appointmentId: null
    });
    const service = new ConsentsService(prisma as never);

    await expect(
      service.generatePatientConsent(
        actor,
        "patient-1",
        { templateId: "template-1" },
        "idem-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks field edits after a consent reaches a terminal state", async () => {
    const prisma = mockPrisma();
    prisma.consent.findFirst.mockResolvedValue({
      id: "consent-1",
      organizationId: "org-1",
      branchId: "branch-1",
      version: 2,
      status: ConsentStatus.SIGNED,
      signatures: [],
      templateVersion: {
        editorSchemaJson: { type: "doc", content: [] },
        requiredSignersJson: {}
      }
    });
    const service = new ConsentsService(prisma as never);

    await expect(
      service.updateConsentFields(actor, "consent-1", { values: {}, expectedVersion: 2 })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.consent.updateMany).not.toHaveBeenCalled();
  });

  it("checks the signer-specific permission in the service layer", async () => {
    const prisma = mockPrisma();
    const service = new ConsentsService(prisma as never);

    await expect(
      service.addSignature(actor, "consent-1", {
        signerType: "PROFESSIONAL",
        signerName: "Dra. Ejemplo",
        signatureMethod: "DRAWN",
        signatureDataUrl: "data:image/png;base64,AA==",
        documentHash: "a".repeat(64),
        acceptanceText: "Acepto el contenido completo del consentimiento.",
        acceptanceTextVersion: "v1"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.consent.findFirst).not.toHaveBeenCalled();
  });

  it("requires the current password before voiding a consent", async () => {
    const prisma = mockPrisma();
    prisma.consent.findFirst.mockResolvedValue({
      id: "consent-1",
      organizationId: "org-1",
      branchId: "branch-1",
      version: 2,
      status: ConsentStatus.SIGNED,
      signatures: [],
      templateVersion: { editorSchemaJson: {}, requiredSignersJson: {} }
    });
    prisma.user.findFirst.mockResolvedValue({ passwordHash: await bcrypt.hash("Correct123!", 4) });
    const service = new ConsentsService(prisma as never);

    await expect(
      service.voidConsent(actor, "consent-1", {
        reason: "Documento emitido con datos equivocados.",
        currentPassword: "Wrong123!",
        expectedVersion: 2
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("encrypts stored clinical files and decrypts them without changing their bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dentalink-consent-"));
    const target = join(directory, "signature.bin");
    const service = new ConsentsService(mockPrisma() as never);
    const plain = Buffer.from("firma-clinica-sensible");

    try {
      await (service as any).writeEncryptedFile(target, plain);
      const stored = await readFile(target);
      expect(stored.equals(plain)).toBe(false);
      await expect((service as any).readEncryptedFile(target)).resolves.toEqual(plain);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function mockPrisma() {
  return {
    consentTemplate: {
      findFirst: jest.fn()
    },
    consent: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn()
    },
    user: {
      findFirst: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  };
}
