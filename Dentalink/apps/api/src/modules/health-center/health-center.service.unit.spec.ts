import { BadRequestException } from "@nestjs/common";
import { BranchBrandStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { HealthCenterService } from "./health-center.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "One",
  roleIds: [],
  roleNames: [],
  branchIds: ["branch-1"],
  permissions: ["health_center.view"]
};

const manager: AuthUser = {
  ...actor,
  permissions: ["health_center.manage", "branches.view_all"]
};

function buildService() {
  const tx = {
    branchBrand: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "brand-new", ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "brand-1", ...data }))
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
  const prisma = {
    branchBrand: {
      findMany: jest.fn().mockResolvedValue([{ id: "brand-1", name: "Dental+", branches: [] }]),
      findFirst: jest.fn(),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "brand-1", ...data }))
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({ id: "org-1", name: "DentalSuite" })
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  const branchesService = {
    create: jest.fn().mockResolvedValue({ id: "branch-1" })
  };

  return { service: new HealthCenterService(prisma as never, branchesService as never), prisma, tx, branchesService };
}

describe("HealthCenterService", () => {
  it("limits brand listing to actor branches unless the actor can view all branches", async () => {
    const { service, prisma } = buildService();

    await service.listBrands(actor, {});

    expect(prisma.branchBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          branches: {
            some: expect.objectContaining({
              organizationId: "org-1",
              deletedAt: null,
              id: { in: ["branch-1"] }
            })
          }
        }),
        include: expect.objectContaining({
          branches: expect.objectContaining({
            where: expect.objectContaining({ id: { in: ["branch-1"] } })
          })
        })
      })
    );
  });

  it("does not branch-limit managers when listing brands", async () => {
    const { service, prisma } = buildService();

    await service.listBrands(manager, {});

    expect(prisma.branchBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ branches: expect.anything() }),
        include: expect.objectContaining({
          branches: expect.objectContaining({
            where: expect.not.objectContaining({ id: expect.anything() })
          })
        })
      })
    );
  });

  it("clears the previous default brand before creating a new default", async () => {
    const { service, prisma, tx } = buildService();
    prisma.branchBrand.findFirst.mockResolvedValue(null);

    await service.createBrand(manager, {
      name: "Nueva Marca",
      slug: "Nueva Marca",
      primaryColor: "#0f766e",
      secondaryColor: "#0f172a",
      isDefault: true
    });

    expect(tx.branchBrand.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", isDefault: true },
      data: { isDefault: false, updatedById: "user-1" }
    });
    expect(tx.branchBrand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          name: "Nueva Marca",
          slug: "nueva-marca",
          isDefault: true,
          createdById: "user-1"
        })
      })
    );
  });

  it("blocks archiving the default brand", async () => {
    const { service, prisma } = buildService();
    prisma.branchBrand.findFirst.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      isDefault: true,
      branches: []
    });

    await expect(service.archiveBrand(manager, "brand-1")).rejects.toThrow(BadRequestException);
    expect(prisma.branchBrand.update).not.toHaveBeenCalled();
  });

  it("blocks archiving brands with active branches", async () => {
    const { service, prisma } = buildService();
    prisma.branchBrand.findFirst.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      isDefault: false,
      branches: [{ id: "branch-1" }]
    });

    await expect(service.archiveBrand(manager, "brand-1")).rejects.toThrow(BadRequestException);
    expect(prisma.branchBrand.update).not.toHaveBeenCalled();
  });

  it("restores an archived brand without making it default", async () => {
    const { service, prisma } = buildService();
    prisma.branchBrand.findFirst.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      isDefault: false,
      status: BranchBrandStatus.ARCHIVED
    });

    await service.restoreBrand(manager, "brand-1");

    expect(prisma.branchBrand.update).toHaveBeenCalledWith({
      where: { id: "brand-1" },
      data: {
        status: BranchBrandStatus.ACTIVE,
        isActive: true,
        archivedAt: null,
        updatedById: "user-1"
      }
    });
  });
});
