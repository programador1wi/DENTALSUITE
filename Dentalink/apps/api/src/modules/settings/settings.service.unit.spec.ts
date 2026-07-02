import { PaymentStatus, Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { SettingsService } from "./settings.service";

describe("SettingsService payroll", () => {
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

  const completedAt = new Date("2026-06-20T12:00:00.000Z");
  const paidAt = new Date("2026-06-21T12:00:00.000Z");

  function treatmentItem(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "item-1",
      treatmentPlanId: "plan-abcdef",
      procedureId: "procedure-1",
      toothNumber: "11",
      surface: null,
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(100),
      discount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(100),
      status: "COMPLETED",
      notes: null,
      plannedAt: null,
      completedAt,
      agreementId: null,
      agreementCoverage: new Prisma.Decimal(0),
      agreementPaidAt: null,
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      completedByEvolutionId: "evolution-1",
      procedure: { id: "procedure-1", categoryId: "category-1", code: "LIMP", name: "Limpieza" },
      treatmentPlan: {
        id: "plan-abcdef",
        branchId: "branch-1",
        patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
        professional: {
          id: "professional-1",
          firstName: "Dr",
          lastName: "Perez",
          commissionRate: new Prisma.Decimal(40)
        }
      },
      paymentAllocations: [
        {
          amount: new Prisma.Decimal(100),
          payment: {
            id: "payment-1",
            paidAt,
            status: PaymentStatus.ALLOCATED,
            paymentMethod: { name: "Efectivo" },
            cashMovements: [{ id: "cash-movement-1" }]
          }
        }
      ],
      ...overrides
    };
  }

  it("lists only fully paid completed items in active payroll summaries", async () => {
    const partialItem = treatmentItem({
      id: "item-2",
      total: new Prisma.Decimal(200),
      paymentAllocations: [
        {
          amount: new Prisma.Decimal(100),
          payment: {
            id: "payment-2",
            paidAt,
            status: PaymentStatus.PARTIALLY_ALLOCATED,
            paymentMethod: { name: "Tarjeta" },
            cashMovements: [{ id: "cash-movement-2" }]
          }
        }
      ]
    });
    const prisma = {
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([treatmentItem(), partialItem])
      },
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new SettingsService(prisma as never);

    const result = await service.listPayroll(actor, "branch-1");

    expect(prisma.treatmentPlanItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "COMPLETED",
          paymentAllocations: {
            some: {
              payment: {
                status: {
                  in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
                }
              }
            }
          }
        })
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        professionalId: "professional-1",
        completedItems: 1,
        pendingItems: 1,
        collectedAmount: 100,
        payableAmount: 40
      })
    );
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0]).toEqual(
      expect.objectContaining({
        treatmentNumber: "ABCDEF",
        patientName: "Ana Lopez",
        action: "Limpieza",
        paymentMethods: "Efectivo",
        cashValidated: true,
        isReady: true
      })
    );
    expect(result[0].items[0].calculationExplanation).toContain("40%");
  });

  it("uses fixed contract amounts before percentage calculations", async () => {
    const prisma = {
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([treatmentItem()])
      },
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue({
          id: "contract-1",
          contractType: "PERFORMED_AND_PAID",
          commissionBase: "CLINICAL",
          paymentDiscount: "NONE",
          paymentCondition: "ANY_DUE_DATE",
          commissionRate: new Prisma.Decimal(30),
          priceListId: "price-list-1",
          priceListName: "Arancel base",
          branches: [{ branchId: "branch-1" }],
          categoryRates: [],
          fixedAmounts: [
            {
              procedureId: "procedure-1",
              amount: new Prisma.Decimal(55),
              priceListId: "price-list-1",
              currency: "MXN"
            }
          ]
        })
      }
    };
    const service = new SettingsService(prisma as never);

    const result = await service.listPayroll(actor, "branch-1");

    expect(result[0]).toEqual(
      expect.objectContaining({
        payableAmount: 55
      })
    );
    expect(result[0].items[0]).toEqual(
      expect.objectContaining({
        commissionRate: 30,
        payableAmount: 55,
        contractRule: expect.objectContaining({
          source: "FIXED_AMOUNT",
          contractId: "contract-1",
          fixedAmount: 55
        })
      })
    );
    expect(result[0].items[0].calculationExplanation).toContain("Monto fijo");
  });

  it("uses category contract rates when no fixed amount matches", async () => {
    const prisma = {
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([treatmentItem()])
      },
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue({
          id: "contract-2",
          contractType: "PERFORMED_AND_PAID",
          commissionBase: "CLINICAL",
          paymentDiscount: "NONE",
          paymentCondition: "ANY_DUE_DATE",
          commissionRate: new Prisma.Decimal(30),
          priceListId: null,
          priceListName: null,
          branches: [{ branchId: "branch-1" }],
          categoryRates: [{ procedureCategoryId: "category-1", rate: new Prisma.Decimal(60) }],
          fixedAmounts: []
        })
      }
    };
    const service = new SettingsService(prisma as never);

    const result = await service.listPayroll(actor, "branch-1");

    expect(result[0]).toEqual(
      expect.objectContaining({
        payableAmount: 60
      })
    );
    expect(result[0].items[0]).toEqual(
      expect.objectContaining({
        commissionRate: 60,
        contractRule: expect.objectContaining({
          source: "CATEGORY_RATE",
          contractId: "contract-2",
          procedureCategoryId: "category-1"
        })
      })
    );
    expect(result[0].items[0].calculationExplanation).toContain("porcentaje avanzado");
  });

  it("finalizes payroll with the current commission after recalculation", async () => {
    const professional = {
      id: "professional-1",
      organizationId: "org-1",
      isActive: true,
      commissionRate: new Prisma.Decimal(45)
    };
    const txResult = {
      id: "liquidation-1",
      professionalId: "professional-1",
      branchId: "branch-1",
      commissionRate: new Prisma.Decimal(45),
      completedItems: 1,
      collectedAmount: new Prisma.Decimal(100),
      payableAmount: new Prisma.Decimal(45),
      finalizedAt: new Date("2026-06-22T12:00:00.000Z"),
      professional: { id: "professional-1", firstName: "Dr", lastName: "Perez" },
      branch: { id: "branch-1", name: "Centro" },
      finalizedBy: { id: "user-1", firstName: "Admin", lastName: "One" },
      _count: { items: 1 }
    };
    const prisma = {
      professional: {
        findFirst: jest.fn().mockResolvedValue(professional)
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([
          treatmentItem({
            treatmentPlan: {
              id: "plan-abcdef",
              branchId: "branch-1",
              patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
              professional: {
                id: "professional-1",
                firstName: "Dr",
                lastName: "Perez",
                commissionRate: new Prisma.Decimal(45)
              }
            }
          })
        ])
      },
      professionalContract: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      payrollLiquidation: {
        create: jest.fn().mockResolvedValue(txResult)
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const service = new SettingsService(prisma as never);

    await service.finalizePayroll(actor, { professionalId: "professional-1", branchId: "branch-1" });

    expect(prisma.payrollLiquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionRate: 45,
          completedItems: 1,
          items: {
            create: [
              expect.objectContaining({
                treatmentPlanItemId: "item-1",
                collectedAmount: expect.any(Prisma.Decimal),
                payableAmount: expect.any(Prisma.Decimal),
                commissionRate: expect.any(Prisma.Decimal),
                contractRule: expect.objectContaining({ source: "PROFESSIONAL_FALLBACK" })
              })
            ]
          }
        })
      })
    );

    const createCall = prisma.payrollLiquidation.create.mock.calls[0][0];
    expect(createCall.data.items.create[0].payableAmount.toString()).toBe("45");
  });
});
