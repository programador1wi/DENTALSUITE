import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
  PhotographicSessionStatus,
  PhotographicSessionType,
  PhotographicUploadSessionStatus
} from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { PhotographicTemplatesService } from "./photographic-templates.service";

describe("PhotographicTemplatesService", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "clinician@example.com",
    firstName: "Clinician",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    permissions: [],
    branchIds: ["branch-1"]
  };

  it("rotates a one-time mobile invitation into a separate upload token", async () => {
    const prisma = prismaMock();
    prisma.photographicUploadSession.findUnique.mockResolvedValue({
      id: "upload-1",
      tokenHash: "initial-hash",
      status: PhotographicUploadSessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      photographicSessionId: "session-1",
      createdById: "user-1",
      createdAt: new Date(),
      claimedAt: null,
      usedAt: null,
      revokedAt: null,
      failedAttempts: 0,
      photographicSession: sessionFixture()
    });
    prisma.photographicSlot.findMany.mockResolvedValue(slotFixtures());
    const service = serviceWith(prisma);

    const claimed = await service.claimMobileUpload("one-time-invitation");

    expect(claimed.uploadToken).not.toBe("one-time-invitation");
    expect(prisma.photographicUploadSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "upload-1" },
        data: expect.objectContaining({ status: PhotographicUploadSessionStatus.CLAIMED })
      })
    );
    expect(claimed.session).toEqual(expect.objectContaining({ id: "session-1", name: "Inicial" }));
    expect(claimed.slots).toHaveLength(10);
  });

  it("expires a mobile invitation before exposing session data", async () => {
    const prisma = prismaMock();
    prisma.photographicUploadSession.findUnique.mockResolvedValue({
      id: "upload-1",
      tokenHash: "expired",
      status: PhotographicUploadSessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 1),
      photographicSessionId: "session-1",
      createdById: "user-1",
      createdAt: new Date(),
      claimedAt: null,
      usedAt: null,
      revokedAt: null,
      failedAttempts: 0,
      photographicSession: sessionFixture()
    });
    const service = serviceWith(prisma);

    await expect(service.claimMobileUpload("expired-invitation")).rejects.toThrow(BadRequestException);
    expect(prisma.photographicUploadSession.update).toHaveBeenCalledWith({
      where: { id: "upload-1" },
      data: { status: PhotographicUploadSessionStatus.EXPIRED }
    });
  });

  it("rejects comparison between sessions from different treatment plans", async () => {
    const prisma = prismaMock();
    prisma.photographicSession.findFirst
      .mockResolvedValueOnce(sessionFixture())
      .mockResolvedValueOnce({ ...sessionFixture(), id: "session-2", treatmentPlanId: "plan-2" });
    prisma.photographicSession.findUniqueOrThrow
      .mockResolvedValueOnce({ ...sessionFixture(), images: [], links: [] })
      .mockResolvedValueOnce({
        ...sessionFixture(),
        id: "session-2",
        treatmentPlanId: "plan-2",
        images: [],
        links: []
      });
    const service = serviceWith(prisma);

    await expect(service.compare(actor, "session-1", "session-2")).rejects.toThrow(BadRequestException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("uses optimistic versioning when an administrator changes a slot", async () => {
    const prisma = prismaMock();
    prisma.photographicSlot.findFirst.mockResolvedValue(slotFixtures()[0]);
    prisma.photographicSlot.updateMany.mockResolvedValue({ count: 0 });
    const service = serviceWith(prisma);

    await expect(
      service.updateSlot(actor, "slot-1", { version: 1, label: "Frontal corregida" })
    ).rejects.toThrow(ConflictException);
  });

  it("does not expose voided sessions without the dedicated permission", async () => {
    const prisma = prismaMock();
    const service = serviceWith(prisma);

    await expect(service.list(actor, "plan-1", true)).rejects.toThrow(ForbiddenException);
    expect(prisma.photographicSession.findFirst).not.toHaveBeenCalled();
  });
});

function serviceWith(prisma: ReturnType<typeof prismaMock>) {
  return new PhotographicTemplatesService(
    prisma as never,
    { prepareAndStore: jest.fn(), cleanup: jest.fn(), storeEdited: jest.fn() } as never,
    { get: jest.fn() } as never
  );
}

function prismaMock() {
  const photographicSlot = {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    updateMany: jest.fn()
  };
  return {
    photographicUploadSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn()
    },
    photographicSlot,
    photographicSession: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((input: unknown) =>
      Array.isArray(input)
        ? Promise.all(input)
        : (input as (tx: unknown) => Promise<unknown>)({ photographicSlot })
    )
  };
}

function sessionFixture() {
  return {
    id: "session-1",
    organizationId: "org-1",
    patientId: "patient-1",
    treatmentPlanId: "plan-1",
    branchId: "branch-1",
    name: "Inicial",
    sessionType: PhotographicSessionType.INITIAL,
    clinicalDate: new Date("2026-01-15"),
    professionalId: "professional-1",
    status: PhotographicSessionStatus.INCOMPLETE,
    notes: null,
    createdById: "user-1",
    createdAt: new Date(),
    updatedById: null,
    updatedAt: new Date(),
    completedAt: null,
    voidedById: null,
    voidedAt: null,
    voidReason: null,
    idempotencyKey: null,
    version: 1
  };
}

function slotFixtures() {
  return Array.from({ length: 10 }, (_, index) => ({
    id: `slot-${index + 1}`,
    organizationId: "org-1",
    code: `SLOT_${index + 1}`,
    label: `Slot ${index + 1}`,
    group: index < 4 ? "FACIAL" : "INTRAORAL",
    sortOrder: index + 1,
    rowNumber: index < 4 ? 1 : index < 7 ? 2 : 3,
    columnNumber: index < 4 ? index + 1 : index < 7 ? index - 3 : index - 6,
    isRequired: true,
    recommendedOrientation: null,
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
}
