import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { SpecialtiesService } from "./specialties.service";

describe("SpecialtiesService - appointment reasons", () => {
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

  function buildPrisma() {
    return {
      specialty: {
        findFirst: jest.fn().mockResolvedValue({
          id: "specialty-1",
          organizationId: "org-1",
          name: "Ortodoncia",
          description: null,
          isActive: true
        })
      },
      specialtyAppointmentReason: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: "reason-1",
          specialtyId: "specialty-1",
          legacyId: 207,
          name: "ADITAMENTOS ADICIONALES",
          durationMinutes: 30,
          color: "#000000",
          isActive: true
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: "reason-1",
          specialtyId: "specialty-1",
          legacyId: 207,
          name: "ADITAMENTOS ADICIONALES",
          durationMinutes: 30,
          color: "#000000",
          isActive: false
        })
      },
      auditLog: {
        create: jest.fn()
      }
    };
  }

  it("lists appointment reasons ordered by legacy id", async () => {
    const prisma = buildPrisma();
    prisma.specialtyAppointmentReason.findMany.mockResolvedValueOnce([
      { id: "new", legacyId: null, name: "NUEVO", durationMinutes: 20, color: null, isActive: true },
      { id: "r208", legacyId: 208, name: "ALINEADORES", durationMinutes: 60, color: "#000000", isActive: true },
      { id: "r207", legacyId: 207, name: "ADITAMENTOS ADICIONALES", durationMinutes: 30, color: "#000000", isActive: true }
    ]);
    const service = new SpecialtiesService(prisma as never);

    const result = await service.listAppointmentReasons(actor, "specialty-1");

    expect(result.map((reason: { id: string }) => reason.id)).toEqual(["r207", "r208", "new"]);
  });

  it("rejects normalized duplicate reason names on create", async () => {
    const prisma = buildPrisma();
    prisma.specialtyAppointmentReason.findMany.mockResolvedValueOnce([
      { id: "reason-1", name: "AJUSTE DE OCLUSIÓN" }
    ]);
    const service = new SpecialtiesService(prisma as never);

    await expect(
      service.createAppointmentReason(actor, "specialty-1", {
        name: "ajuste de oclusion",
        durationMinutes: 20,
        color: "#eeeeee"
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.specialtyAppointmentReason.create).not.toHaveBeenCalled();
  });

  it("suspends an appointment reason without deleting it", async () => {
    const prisma = buildPrisma();
    const service = new SpecialtiesService(prisma as never);

    await service.updateAppointmentReason(actor, "specialty-1", "reason-1", { isActive: false });

    expect(prisma.specialtyAppointmentReason.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reason-1" },
        data: expect.objectContaining({ isActive: false })
      })
    );
  });
});
