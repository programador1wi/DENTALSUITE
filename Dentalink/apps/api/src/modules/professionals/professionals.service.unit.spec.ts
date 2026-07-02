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

  it("merges previous fixed amounts and category rates when keepPrevious is enabled", async () => {
    const tx = {
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue({
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
        count: jest.fn().mockResolvedValue(1)
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "professional-1",
            branches: [{ branchId: "branch-1" }]
          }
        ])
      },
      priceList: {
        findFirst: jest.fn().mockResolvedValue({
          id: "price-list-new",
          name: "Arancel nuevo",
          items: [
            {
              procedureId: "procedure-new",
              price: new Prisma.Decimal(120),
              currency: "MXN"
            }
          ]
        })
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
});
