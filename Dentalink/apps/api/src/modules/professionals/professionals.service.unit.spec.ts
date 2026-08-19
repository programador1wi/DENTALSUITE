import { Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { ProfessionalsService } from "./professionals.service";

describe("ProfessionalsService bulk contracts", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  const branchRecord = {
    id: "branch-1",
    zone: { code: "NORTE" }
  };

  const professionalRecord = {
    id: "professional-1",
    branches: [{ branchId: "branch-1" }]
  };

  const priceListRecord = {
    id: "price-list-new",
    name: "Arancel nuevo",
    categories: [{ procedureCategoryId: "category-new" }],
    items: [
      {
        procedureId: "procedure-new",
        price: new Prisma.Decimal(120),
        currency: "MXN"
      }
    ]
  };

  it("merges previous fixed amounts and category rates when keepPrevious is enabled", async () => {
    const tx = {
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue({
          id: "contract-old",
          branches: [{ branchId: "branch-1" }],
          categoryRates: [{ procedureCategoryId: "category-old", rate: new Prisma.Decimal(35) }],
          fixedAmounts: [
            {
              procedureId: "procedure-old",
              priceListId: "price-list-old",
              amount: new Prisma.Decimal(80),
              currency: "MXN"
            }
          ]
        }),
        updateMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "contract-1",
          professionalId: data.professionalId,
          commissionRate: new Prisma.Decimal(data.commissionRate),
          priceListId: data.priceListId,
          priceListName: data.priceListName,
          branches: data.branches.create,
          categoryRates: data.categoryRates.create,
          fixedAmounts: data.fixedAmounts.create
        }))
      },
      professional: {
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue([branchRecord])
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([professionalRecord])
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue(priceListRecord)
      },
      procedureCategory: {
        count: jest.fn().mockResolvedValue(1)
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new ProfessionalsService(prisma as never);

    const result = await service.bulkUpdateContracts(actor, {
      targets: [{ professionalId: "professional-1", branchIds: ["branch-1"] }],
      commissionRate: 50,
      commissionBase: "clinical",
      paymentDiscount: "no",
      paymentCondition: "no_due_date",
      contractType: "performed_and_paid",
      priceListId: "price-list-new",
      categoryRates: [{ procedureCategoryId: "category-new", rate: 60 }],
      keepPrevious: true
    });

    expect(tx.professionalContract.updateMany).not.toHaveBeenCalled();
    expect(tx.professionalContract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryRates: {
            create: expect.arrayContaining([
              { procedureCategoryId: "category-old", rate: expect.any(Prisma.Decimal) },
              { procedureCategoryId: "category-new", rate: 60 }
            ])
          },
          fixedAmounts: {
            create: expect.arrayContaining([
              expect.objectContaining({
                procedureId: "procedure-old",
                amount: expect.any(Prisma.Decimal)
              }),
              expect.objectContaining({
                procedureId: "procedure-new",
                amount: expect.any(Prisma.Decimal)
              })
            ])
          }
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        updatedProfessionals: 1,
        fixedAmounts: 2,
        categoryRates: 2
      })
    );
  });

  it("uses an explicit empty fixedAmounts array instead of expanding the selected price list", async () => {
    const tx = {
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "contract-1",
          professionalId: data.professionalId,
          commissionRate: new Prisma.Decimal(data.commissionRate),
          priceListId: data.priceListId,
          priceListName: data.priceListName,
          branches: data.branches.create,
          categoryRates: data.categoryRates.create,
          fixedAmounts: data.fixedAmounts.create
        }))
      },
      professional: {
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue([branchRecord])
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([professionalRecord])
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue(priceListRecord)
      },
      procedureCategory: {
        count: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new ProfessionalsService(prisma as never);

    const result = await service.bulkUpdateContracts(actor, {
      targets: [{ professionalId: "professional-1", branchIds: ["branch-1"] }],
      commissionRate: 50,
      commissionBase: "clinical",
      paymentDiscount: "no",
      paymentCondition: "no_due_date",
      contractType: "performed_and_paid",
      priceListId: "price-list-new",
      fixedAmounts: []
    });

    expect(tx.professionalContract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fixedAmounts: { create: [] }
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        updatedProfessionals: 1,
        fixedAmounts: 0,
        categoryRates: 0
      })
    );
  });

  it("rejects category rates outside the selected price list", async () => {
    const prisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue([branchRecord])
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([professionalRecord])
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue(priceListRecord)
      },
      procedureCategory: {
        count: jest.fn()
      },
      $transaction: jest.fn()
    };
    const service = new ProfessionalsService(prisma as never);

    await expect(
      service.bulkUpdateContracts(actor, {
        targets: [{ professionalId: "professional-1", branchIds: ["branch-1"] }],
        commissionRate: 50,
        commissionBase: "clinical",
        paymentDiscount: "no",
        paymentCondition: "no_due_date",
        contractType: "performed_and_paid",
        priceListId: "price-list-new",
        categoryRates: [{ procedureCategoryId: "category-outside", rate: 80 }]
      })
    ).rejects.toThrow("One or more procedure categories are outside the selected price list");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("previews bulk contract impact without writing to the database", async () => {
    const prisma = {
      branch: {
        findMany: jest.fn().mockResolvedValue([branchRecord])
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([professionalRecord])
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue(priceListRecord)
      },
      procedureCategory: {
        count: jest.fn()
      },
      professionalContract: {
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
      },
      $transaction: jest.fn()
    };
    const service = new ProfessionalsService(prisma as never);

    const result = await service.previewBulkUpdateContracts(actor, {
      targets: [{ professionalId: "professional-1", branchIds: ["branch-1"] }],
      commissionRate: 0,
      commissionBase: "clinical",
      paymentDiscount: "no",
      paymentCondition: "no_due_date",
      contractType: "performed_and_paid",
      priceListId: "price-list-new",
      fixedAmounts: [
        {
          procedureId: "procedure-new",
          amount: 95
        }
      ],
      removeOtherBranches: true,
      keepPrevious: false
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        professionals: 1,
        branches: 1,
        scopes: 1,
        contractsToCreate: 1,
        currentContractsToClose: 1,
        otherContractsToClose: 2,
        fixedAmounts: 1,
        categoryRates: 0,
        zoneCodes: ["NORTE"]
      })
    );
    expect(result.warnings).toContain("Se cerraran contratos activos fuera de las sucursales seleccionadas.");
  });
});

describe("ProfessionalsService branch validation", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1", "branch-2"],
    permissions: []
  };

  it("rejects multiple active branch assignments with a clear Spanish message", async () => {
    const prisma = {
      branch: {
        count: jest.fn()
      }
    };
    const service = new ProfessionalsService(prisma as never);

    await expect(
      service.create(actor, {
        firstName: "Ana",
        lastName: "Lopez",
        branchIds: ["branch-1", "branch-2"]
      } as never)
    ).rejects.toThrow("Un profesional solo puede tener una sucursal activa. Selecciona una sucursal clinica.");
    expect(prisma.branch.count).not.toHaveBeenCalled();
  });
});

describe("ProfessionalsService deactivation impact", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["professionals.read", "professionals.deactivate"]
  };

  it("blocks direct deactivation when an active schedule still exists", async () => {
    const branch = { id: "branch-1", agendaSlotMinutes: 20 };
    const prisma = {
      professional: {
        findFirst: jest.fn().mockResolvedValue({
          id: "professional-1",
          specialties: [],
          branches: [{
            branch,
            agendaSlotMinutes: 20,
            status: "ACTIVE",
            startsAt: new Date(),
            endsAt: null,
            endedReason: null
          }],
          user: null
        })
      },
      appointment: { count: jest.fn().mockResolvedValue(0) },
      professionalSchedule: { count: jest.fn().mockResolvedValue(1) }
    };
    const service = new ProfessionalsService(prisma as never);

    const impact = await service.deactivationImpact(actor, "professional-1");

    expect(impact).toEqual(expect.objectContaining({
      futureAppointments: 0,
      futureBlocks: 0,
      activeSchedules: 1,
      canDeactivate: false
    }));
  });
});
