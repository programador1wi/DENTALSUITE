import { BadRequestException } from "@nestjs/common";
import { CollaboratorsService } from "./collaborators.service";

const actor = {
  id: "actor-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User",
  roleIds: ["role-admin"],
  roleNames: ["ADMIN"],
  permissions: ["users.read", "users.create", "professionals.read", "professionals.create", "professionals.update"],
  branchIds: ["branch-1", "branch-2"]
};

function transactionClient() {
  return {
    user: { create: jest.fn().mockResolvedValue({ id: "user-1", firstName: "Ana", lastName: "Clinica", email: "ana@example.com", phone: null }) },
    userRole: { create: jest.fn().mockResolvedValue({}) },
    userBranch: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    professional: {
      create: jest.fn().mockResolvedValue({ id: "professional-1" }),
      update: jest.fn().mockResolvedValue({})
    },
    professionalSpecialty: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    professionalBranch: { create: jest.fn().mockResolvedValue({}) },
    professionalSchedule: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
}

function prismaMock() {
  const tx = transactionClient();
  return {
    tx,
    role: { findFirst: jest.fn().mockResolvedValue({ id: "role-1" }) },
    branch: {
      count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)),
      findFirst: jest.fn().mockResolvedValue({ id: "branch-1", agendaStartHour: 8, agendaEndHour: 20 })
    },
    specialty: { findMany: jest.fn().mockResolvedValue([{ id: "specialty-1", name: "Ortodoncia" }]) },
    chair: { findFirst: jest.fn() },
    professionalSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    professional: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null)
    },
    $transaction: jest.fn(async (callback: (client: ReturnType<typeof transactionClient>) => unknown) => callback(tx))
  };
}

describe("CollaboratorsService", () => {
  it("creates an administrative user without creating a professional", async () => {
    const prisma = prismaMock();
    const service = new CollaboratorsService(prisma as never);

    const result = await service.create(actor, {
      kind: "ADMINISTRATIVE",
      email: "ana@example.com",
      password: "password123",
      firstName: "Ana",
      lastName: "Admin",
      roleId: "role-1",
      branchIds: ["branch-1"],
      primaryBranchId: "branch-1"
    });

    expect(result).toEqual({ userId: "user-1", professionalId: null });
    expect(prisma.tx.professional.create).not.toHaveBeenCalled();
  });

  it("creates user and clinical profile in the same transaction", async () => {
    const prisma = prismaMock();
    const service = new CollaboratorsService(prisma as never);

    const result = await service.create(actor, {
      kind: "CLINICAL",
      email: "ana@example.com",
      password: "password123",
      firstName: "Ana",
      lastName: "Clinica",
      roleId: "role-1",
      branchIds: ["branch-1", "branch-2"],
      primaryBranchId: "branch-1",
      clinicalProfile: {
        branchId: "branch-1",
        specialtyIds: ["specialty-1"],
        commissionRate: 20,
        agendaSlotMinutes: 20,
        defaultAppointmentDurationMinutes: 40
      }
    });

    expect(result).toEqual({ userId: "user-1", professionalId: "professional-1" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.user.create).toHaveBeenCalled();
    expect(prisma.tx.professional.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1" }) }));
    expect(prisma.tx.professionalBranch.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ branchId: "branch-1" }) }));
  });

  it("propagates a clinical creation failure instead of returning a partial success", async () => {
    const prisma = prismaMock();
    prisma.tx.professional.create.mockRejectedValueOnce(new Error("clinical failure"));
    const service = new CollaboratorsService(prisma as never);

    await expect(service.create(actor, {
      kind: "CLINICAL",
      email: "ana@example.com",
      password: "password123",
      firstName: "Ana",
      lastName: "Clinica",
      roleId: "role-1",
      branchIds: ["branch-1"],
      clinicalProfile: { branchId: "branch-1", specialtyIds: ["specialty-1"] }
    })).rejects.toThrow("clinical failure");
    expect(prisma.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects creating access for a professional that is already linked", async () => {
    const prisma = prismaMock();
    prisma.professional.findFirst.mockResolvedValue({
      id: "professional-1",
      userId: "existing-user",
      branches: [{ branchId: "branch-1" }]
    });
    const service = new CollaboratorsService(prisma as never);

    await expect(service.createProfessionalAccess(actor, "professional-1", {
      email: "ana@example.com",
      password: "password123",
      roleId: "role-1",
      branchIds: ["branch-1"]
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a duplicated access email before opening the transaction", async () => {
    const prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });
    const service = new CollaboratorsService(prisma as never);

    await expect(service.create(actor, {
      kind: "ADMINISTRATIVE",
      email: "existing@example.com",
      password: "password123",
      firstName: "Ana",
      lastName: "Admin",
      roleId: "role-1",
      branchIds: ["branch-1"]
    })).rejects.toThrow("El correo ya esta registrado en otro usuario");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates access and links an historical professional in one transaction", async () => {
    const prisma = prismaMock();
    prisma.professional.findFirst.mockResolvedValue({
      id: "professional-1",
      userId: null,
      branches: [{ branchId: "branch-1" }]
    });
    prisma.tx.user.create.mockResolvedValue({
      id: "user-1",
      firstName: "Ana",
      lastName: "Clinica",
      email: "historical@example.com",
      phone: null
    });
    const service = new CollaboratorsService(prisma as never);

    const result = await service.createProfessionalAccess(actor, "professional-1", {
      email: "historical@example.com",
      password: "password123",
      roleId: "role-1",
      branchIds: ["branch-1"],
      primaryBranchId: "branch-1"
    });

    expect(result).toEqual({ userId: "user-1", professionalId: "professional-1" });
    expect(prisma.tx.professional.update).toHaveBeenCalledWith({
      where: { id: "professional-1" },
      data: expect.objectContaining({ userId: "user-1", email: "historical@example.com" })
    });
  });

  it("deduplicates a linked clinical collaborator returned by both permitted domains", async () => {
    const prisma = prismaMock();
    const branch = { id: "branch-1", code: "BR1", name: "Sucursal 1" };
    const specialty = { id: "specialty-1", name: "Ortodoncia" };
    const professional = {
      id: "professional-1",
      userId: "user-1",
      firstName: "Ana",
      lastName: "Clinica",
      email: "ana@example.com",
      phone: null,
      licenseNumber: "CED-1",
      commissionRate: 20,
      isActive: true,
      specialties: [{ specialty }],
      branches: [{ branch }]
    };
    const user = {
      id: "user-1",
      firstName: "Ana",
      lastName: "Clinica",
      email: "ana@example.com",
      phone: null,
      status: "ACTIVE",
      role: { id: "role-1", code: "DENTIST", name: "Dentista" },
      branches: [{ branch, isPrimary: true }],
      professional
    };
    prisma.user.findMany.mockResolvedValue([user]);
    prisma.professional.findMany.mockResolvedValue([{ ...professional, user }]);
    const service = new CollaboratorsService(prisma as never);

    const result = await service.findAll(actor, { kind: "CLINICAL", page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      userId: "user-1",
      professionalId: "professional-1",
      kind: "CLINICAL",
      clinicalStatus: "ACTIVE"
    }));
  });

  it("does not expose administrative role, branches or access status with professionals.read alone", async () => {
    const prisma = prismaMock();
    const branch = { id: "branch-1", code: "BR1", name: "Sucursal 1" };
    prisma.professional.findMany.mockResolvedValue([{
      id: "professional-1",
      userId: "user-1",
      firstName: "Ana",
      lastName: "Clinica",
      email: "clinical@example.com",
      phone: "123",
      licenseNumber: "CED-1",
      commissionRate: 20,
      isActive: true,
      specialties: [],
      branches: [{ branch }],
      user: {
        id: "user-1",
        firstName: "Acceso",
        lastName: "Privado",
        email: "private@example.com",
        phone: "999",
        status: "LOCKED",
        role: { id: "role-1", code: "ADMIN", name: "Admin" },
        branches: [{ branch, isPrimary: true }]
      }
    }]);
    const service = new CollaboratorsService(prisma as never);

    const result = await service.findAll({ ...actor, permissions: ["professionals.read"] }, { page: 1, pageSize: 20 });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.items[0]).toEqual(expect.objectContaining({
      firstName: "Ana",
      email: "clinical@example.com",
      role: null,
      accessBranches: [],
      accessStatus: null
    }));
  });
});
