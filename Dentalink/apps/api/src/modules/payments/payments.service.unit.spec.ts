import {
  CashMovementDirection,
  CashMovementType,
  PaymentLinkStatus,
  PaymentStatus,
  Prisma,
  RefundStatus
} from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { PaymentsService } from "./payments.service";

describe("PaymentsService refund listing", () => {
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

  it("requires voiding the complete payment before removing an allocation with a cash discount", async () => {
    const prisma = {
      paymentAllocation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "allocation-1",
          paymentId: "payment-1",
          treatmentPlanItemId: "item-1",
          amount: new Prisma.Decimal(80),
          settlementDiscountAmount: new Prisma.Decimal(20),
          payment: { id: "payment-1", amount: new Prisma.Decimal(80) },
          treatmentPlanItem: { id: "item-1", total: new Prisma.Decimal(100), status: "PAID" }
        })
      },
      $transaction: jest.fn()
    };
    const service = new PaymentsService(prisma as never);

    await expect(service.removeAllocation(actor, "allocation-1")).rejects.toThrow(
      "void the payment to reverse the complete transaction"
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("filters refunds by patient and treatment plan allocations", async () => {
    const prisma = {
      refund: {
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const service = new PaymentsService(prisma as never);

    await service.listRefunds(actor, {
      patientId: "patient-1",
      treatmentPlanId: "plan-1",
      status: RefundStatus.PROCESSED
    } as never);

    expect(prisma.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          patientId: "patient-1",
          status: RefundStatus.PROCESSED,
          branchId: { in: ["branch-1"] },
          payment: {
            allocations: {
              some: {
                treatmentPlanItem: {
                  treatmentPlanId: "plan-1"
                }
              }
            }
          }
        }),
        include: expect.objectContaining({
          payment: expect.objectContaining({
            select: expect.objectContaining({
              allocations: expect.any(Object)
            })
          })
        })
      })
    );
  });

  it("lists cancelled and pending payments without using accounts receivable", async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "payment-1",
            reference: "348717",
            voidedById: "user-2",
            allocations: [
              {
                id: "allocation-1",
                treatmentPlanItem: {
                  treatmentPlan: { id: "plan-1", name: "Ortodoncia" },
                  procedure: { id: "procedure-1", code: "ORT", name: "Brackets" }
                }
              }
            ]
          }
        ]),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { amount: 300 } })
      },
      paymentLink: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 1 }, _sum: { amount: 150 } }),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: PaymentLinkStatus.CREATED, _count: { _all: 1 }, _sum: { amount: 150 } }
          ])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: "user-2", firstName: "Rafael", lastName: "Farrera" }])
      }
    };
    const service = new PaymentsService(prisma as never);

    const result = await service.listCancelledPendingPayments(actor, {
      branchId: "branch-1",
      search: "ana",
      linkStatus: PaymentLinkStatus.CREATED
    } as never);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: PaymentStatus.VOIDED,
          branchId: "branch-1",
          patient: { branchId: "branch-1" }
        })
      })
    );
    expect(prisma.paymentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: { in: [PaymentLinkStatus.CREATED] },
          patient: { branchId: "branch-1" }
        })
      })
    );
    expect(result.summary.voidedPayments).toEqual({ count: 2, amount: 300 });
    expect(result.summary.pendingLinks).toEqual({ count: 1, amount: 150 });
    expect(result.voidedPayments[0]).toEqual(
      expect.objectContaining({
        paymentNumber: "348717",
        voidedBy: { id: "user-2", firstName: "Rafael", lastName: "Farrera" },
        treatments: [{ id: "plan-1", name: "Ortodoncia", number: "765235", procedures: ["Brackets"] }]
      })
    );
  });

  it("rejects paid payment links from the cancelled and pending module", async () => {
    const service = new PaymentsService({} as never);

    await expect(
      service.listCancelledPendingPayments(actor, { linkStatus: PaymentLinkStatus.PAID } as never)
    ).rejects.toThrow("Paid payment links do not belong to cancelled and pending payments");
  });

  it("includes payment void audit fields in cash-register detail", async () => {
    const openedAt = new Date("2026-08-07T14:00:00.000Z");
    const prisma = {
      cashRegister: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: "register-1",
            publicNumber: 811016,
            branchId: "branch-1",
            openedAt,
            previousClosingBalance: new Prisma.Decimal(0),
            expectedCashBalance: null,
            reconciliationSnapshot: null,
            movements: [],
            branch: { id: "branch-1", name: "Sucursal Centro" },
            openedBy: { id: "user-1", firstName: "User", lastName: "One" },
            responsibleUser: { id: "user-1", firstName: "User", lastName: "One" },
            closedBy: null
          })
          .mockResolvedValueOnce(null)
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new PaymentsService(prisma as never);

    await service.getCashRegisterDetail(actor, "CAJ-811016");

    expect(prisma.cashRegister.findFirst.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        include: expect.objectContaining({
          movements: expect.objectContaining({
            include: expect.objectContaining({
              payment: expect.objectContaining({
                select: expect.objectContaining({
                  voidReason: true,
                  voidedAt: true,
                  voidedBy: { select: { id: true, firstName: true, lastName: true } }
                })
              })
            })
          })
        })
      })
    );
  });

  it("exports payment void reason and author in the cash-register CSV", async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new PaymentsService(prisma as never);
    jest.spyOn(service, "getCashRegisterDetail").mockResolvedValue({
      id: "register-1",
      publicNumber: 811016,
      movements: [
        {
          id: "movement-1",
          type: CashMovementType.PAYMENT_VOID,
          direction: CashMovementDirection.OUT,
          amount: new Prisma.Decimal(40505),
          reference: null,
          voidedAt: null,
          voidReason: null,
          createdAt: new Date("2026-08-07T16:30:00.000Z"),
          createdBy: { id: "user-2", firstName: "Marcela", lastName: "Rodriguez" },
          paymentMethod: { name: "Tarjeta" },
          payment: {
            paymentNumber: 212180,
            reference: null,
            voidedAt: new Date("2026-08-07T16:30:00.000Z"),
            voidReason: "Pago duplicado; registrar nuevamente con tarjeta",
            voidedBy: { id: "user-2", firstName: "Marcela", lastName: "Rodriguez" },
            patient: { firstName: "Ricardo", lastName: "Carriola" },
            paymentMethod: { name: "Tarjeta" }
          }
        }
      ]
    } as never);

    const report = await service.getCashRegisterReportCsv(actor, "CAJ-811016");

    expect(report.content).toContain("Motivo anulacion");
    expect(report.content).toContain('"PAYMENT_VOIDED"');
    expect(report.content).toContain('"Marcela Rodriguez"');
    expect(report.content).toContain('"Pago duplicado; registrar nuevamente con tarjeta"');
  });

  it("prevents replacing the historical payment method after collection", async () => {
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payment-1",
          organizationId: "org-1",
          branchId: "branch-1",
          status: PaymentStatus.RECEIVED,
          paymentMethodId: "method-original",
          financialInstitutionId: null,
          reference: null,
          notes: null,
          paidAt: new Date(),
          paymentMethod: { id: "method-original", name: "Efectivo" },
          financialInstitution: null
        })
      }
    };
    const service = new PaymentsService(prisma as never);

    await expect(
      service.updatePayment(actor, "payment-1", { paymentMethodId: "method-replacement" })
    ).rejects.toThrow("El medio de pago histórico no puede reemplazarse");
  });

  it("limits refunds to net funds actually received for scheduled settlements", async () => {
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payment-1",
          organizationId: "org-1",
          branchId: "branch-1",
          patientId: "patient-1",
          paymentMethodId: "method-1",
          paymentMethodSnapshot: null,
          paymentMethod: null,
          amount: new Prisma.Decimal(200),
          netAmount: new Prisma.Decimal(190),
          cashMovements: [{ amount: new Prisma.Decimal(70) }],
          settlements: [
            { id: "settlement-1", status: "RECEIVED" },
            { id: "settlement-2", status: "PENDING" }
          ]
        })
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({
          id: "method-1",
          allowsRefund: true,
          requiresReference: false,
          requiresFinancialInstitution: false
        })
      },
      refund: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(20) } })
      }
    };
    const service = new PaymentsService(prisma as never);

    await expect(service.createRefund(actor, "payment-1", { amount: 51 })).rejects.toThrow(
      "Refund amount exceeds available refundable amount"
    );
  });

  it("removes a payment allocation and keeps the payment as patient credit", async () => {
    const allocation = {
      id: "allocation-1",
      paymentId: "payment-1",
      treatmentPlanItemId: "item-1",
      amount: 50,
      payment: { id: "payment-1", amount: 100 },
      treatmentPlanItem: { id: "item-1", total: 100, status: "PAID" }
    };
    const tx = {
      paymentAllocation: {
        delete: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
          .mockResolvedValueOnce({ _sum: { amount: 0 } })
      },
      payment: {
        update: jest.fn()
      },
      treatmentPlanItem: {
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      paymentAllocation: {
        findFirst: jest.fn().mockResolvedValue(allocation)
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payment-1",
          organizationId: "org-1",
          allocations: [],
          refunds: []
        })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PaymentsService(prisma as never);

    await service.removeAllocation(actor, "allocation-1");

    expect(tx.paymentAllocation.delete).toHaveBeenCalledWith({ where: { id: "allocation-1" } });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: "RECEIVED" }
    });
    expect(tx.treatmentPlanItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { status: "ACCEPTED" }
    });
  });

  it("does not auto-open a cash register during payment collection", async () => {
    const actorWithOpenPermission = { ...actor, permissions: ["cash_register.open"] };
    const prisma = {
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new PaymentsService(prisma as never);

    await expect(
      (service as any).ensureOpenCashRegister(actorWithOpenPermission, "branch-1")
    ).rejects.toThrow("No open cash register found for this user and branch");
  });

  it("rejects cash-register-required payment flow when the user cannot open a register", async () => {
    const prisma = {
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new PaymentsService(prisma as never);

    await expect((service as any).ensureOpenCashRegister(actor, "branch-1")).rejects.toThrow(
      "No open cash register found for this user and branch"
    );
  });

  it("links installment plans to selected treatment plan items", async () => {
    const item = {
      id: "item-1",
      version: 1,
      total: 100,
      status: "ACCEPTED",
      treatmentPlan: { id: "plan-1", isAlternative: false },
      paymentAllocations: [],
      installmentPlanItems: []
    };
    const tx = {
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([item])
      },
      installmentPlan: {
        create: jest.fn().mockResolvedValue({ id: "installment-plan-1" })
      },
      installmentPlanItem: {
        create: jest.fn()
      },
      installment: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: "plan-1", patientId: "patient-1" })
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([item])
      },
      installmentPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: "installment-plan-1", installments: [], items: [] })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PaymentsService(prisma as never);

    await service.createInstallmentPlan(actor, {
      patientId: "patient-1",
      treatmentPlanId: "plan-1",
      totalAmount: 100,
      downPayment: 10,
      numberOfInstallments: 3,
      frequency: "MONTHLY",
      startDate: "2026-01-31",
      itemAllocations: [{ treatmentPlanItemId: "item-1", amount: 100, expectedVersion: 1 }]
    } as never);

    expect(tx.installmentPlanItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        installmentPlanId: "installment-plan-1",
        treatmentPlanItemId: "item-1",
        amount: expect.anything()
      })
    });
    expect(tx.installment.create).toHaveBeenCalledTimes(3);
    expect(tx.installment.create.mock.calls[1][0].data.dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("rejects financing over already committed treatment item balance", async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: "plan-1", patientId: "patient-1" })
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "item-1",
            version: 1,
            total: 100,
            status: "ACCEPTED",
            treatmentPlan: { id: "plan-1", isAlternative: false },
            paymentAllocations: [],
            installmentPlanItems: [{ amount: 90 }]
          }
        ])
      },
      $transaction: jest.fn()
    };
    const service = new PaymentsService(prisma as never);

    await expect(
      service.createInstallmentPlan(actor, {
        patientId: "patient-1",
        treatmentPlanId: "plan-1",
        totalAmount: 20,
        downPayment: 0,
        numberOfInstallments: 2,
        frequency: "MONTHLY",
        startDate: "2026-07-31",
        itemAllocations: [{ treatmentPlanItemId: "item-1", amount: 20, expectedVersion: 1 }]
      } as never)
    ).rejects.toThrow("Installment item allocation exceeds available financing balance");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records partial installment payments through an auditable installment allocation", async () => {
    const installment = {
      id: "installment-1",
      patientId: "patient-1",
      installmentPlanId: "plan-installments-1",
      amount: 100,
      paidAmount: 20,
      status: "PARTIAL",
      dueDate: new Date("2026-07-10T12:00:00.000Z"),
      paymentId: null,
      paidAt: null,
      patient: { id: "patient-1", organizationId: "org-1" },
      installmentPlan: { id: "plan-installments-1", treatmentPlanId: "plan-1" }
    };
    const payment = {
      id: "payment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      receivedById: "user-1",
      amount: 30,
      currency: "MXN",
      paymentMethodId: "method-1",
      financialInstitutionId: null,
      status: "ALLOCATED",
      reference: "AUTH-1",
      notes: null,
      voidReason: null,
      voidedAt: null,
      voidedById: null,
      paidAt: new Date("2026-07-03T12:00:00.000Z"),
      createdAt: new Date("2026-07-03T12:00:00.000Z"),
      updatedAt: new Date("2026-07-03T12:00:00.000Z")
    };
    const tx = {
      payment: {
        create: jest.fn().mockResolvedValue(payment)
      },
      cashMovement: {
        create: jest.fn()
      },
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue({ id: "register-1" })
      },
      paymentInstallmentAllocation: {
        create: jest.fn()
      },
      installment: {
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1)
      },
      installmentPlan: {
        update: jest.fn()
      },
      collectionCase: {
        updateMany: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      installment: {
        findFirst: jest.fn().mockResolvedValue(installment)
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-1" })
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({
          id: "method-1",
          publicCode: "SYS-CASH",
          name: "Efectivo",
          type: "CASH",
          source: "SYSTEM",
          retentionPercent: new Prisma.Decimal(0),
          allowsRefund: true,
          acceptsMultipleSettlements: false,
          requiresReference: false,
          requiresFinancialInstitution: false,
          fiscalCode: null,
          includeInCollectionReports: true,
          includeInPhysicalCashBalance: true,
          includeInCashFlowReports: true,
          includeInClosingSummary: true,
          includeInGraphicalReports: true,
          version: 1
        })
      },
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue({ id: "register-1", status: "OPEN" })
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          ...payment,
          patient: { id: "patient-1", firstName: "Ana", lastName: "Paz", documentNumber: "123" },
          branch: { id: "branch-1", name: "Sucursal" },
          paymentMethod: { id: "method-1", name: "Efectivo", type: "CASH" },
          financialInstitution: null,
          receivedBy: { id: "user-1", firstName: "User", lastName: "One" },
          allocations: [],
          installmentAllocations: [
            {
              id: "allocation-installment-1",
              amount: 30,
              installment: {
                ...installment,
                paidAmount: 50,
                installmentPlan: {
                  id: "plan-installments-1",
                  treatmentPlanId: "plan-1",
                  treatmentPlan: { id: "plan-1", name: "Ortodoncia" }
                }
              }
            }
          ],
          cashMovements: [],
          refunds: []
        })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PaymentsService(prisma as never);

    const result = await service.payInstallment(actor, "installment-1", {
      branchId: "branch-1",
      paymentMethodId: "method-1",
      amount: 30,
      reference: "AUTH-1"
    });

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ALLOCATED",
          paymentNumber: expect.any(Number),
          amount: expect.anything()
        })
      })
    );
    expect(tx.paymentInstallmentAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "payment-1",
        installmentId: "installment-1"
      })
    });
    expect(tx.installment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "installment-1" },
        data: expect.objectContaining({
          status: "PARTIAL",
          paymentId: null
        })
      })
    );
    expect(result.breakdown[0]).toEqual(
      expect.objectContaining({
        kind: "INSTALLMENT",
        treatmentNumber: expect.any(String),
        paidAmount: 30
      })
    );
  });

  it("rejects allocations that exceed the treatment plan item balance", async () => {
    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payment-1",
          organizationId: "org-1",
          patientId: "patient-1",
          amount: 200,
          allocations: []
        })
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "item-1",
            total: 100,
            status: "ACCEPTED",
            treatmentPlan: { isAlternative: false }
          }
        ])
      },
      paymentAllocation: {
        groupBy: jest.fn().mockResolvedValue([{ treatmentPlanItemId: "item-1", _sum: { amount: 80 } }]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };
    const service = new PaymentsService({} as never);
    const allocationService = service as unknown as {
      applyAllocations: (
        txClient: typeof tx,
        currentActor: AuthUser,
        paymentId: string,
        allocations: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>
      ) => Promise<void>;
    };

    await expect(
      allocationService.applyAllocations(tx, actor, "payment-1", [
        { treatmentPlanItemId: "item-1", amount: 30 }
      ])
    ).rejects.toThrow("Allocations exceed treatment plan item balance");
    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.update).not.toHaveBeenCalled();
  });

  it("creates payment method splits and idempotency record in the same payment transaction", async () => {
    const method = (id: string) => ({
      id,
      publicCode: id === "cash" ? "SYS-CASH" : "SYS-CARD",
      source: "SYSTEM",
      name: id === "cash" ? "Efectivo" : "Tarjeta",
      type: id === "cash" ? "CASH" : "CARD",
      isActive: true,
      retentionPercent: 0,
      allowsRefund: true,
      acceptsMultipleSettlements: false,
      requiresReference: false,
      requiresFinancialInstitution: false,
      fiscalCode: null,
      includeInCollectionReports: true,
      includeInPhysicalCashBalance: id === "cash",
      includeInCashFlowReports: true,
      includeInClosingSummary: true,
      includeInGraphicalReports: true,
      version: 1
    });
    const payment = {
      id: "payment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      receivedById: "user-1",
      amount: 100,
      currency: "MXN",
      paymentMethodId: "cash",
      financialInstitutionId: null,
      status: "RECEIVED",
      reference: null,
      notes: null,
      voidReason: null,
      voidedAt: null,
      voidedById: null,
      paidAt: new Date("2026-07-13T12:00:00.000Z"),
      createdAt: new Date("2026-07-13T12:00:00.000Z"),
      updatedAt: new Date("2026-07-13T12:00:00.000Z"),
      idempotencyKey: "idem-1"
    };
    const tx = {
      paymentIdempotency: {
        create: jest.fn().mockResolvedValue({ id: "idem-record-1" }),
        update: jest.fn()
      },
      payment: {
        create: jest.fn().mockResolvedValue(payment)
      },
      paymentMethod: {
        findMany: jest.fn().mockResolvedValue([
          { id: "cash", version: 1 },
          { id: "card", version: 1 }
        ])
      },
      paymentMethodSplit: {
        create: jest.fn()
      },
      cashMovement: {
        create: jest.fn()
      },
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue({ id: "register-1" })
      },
      patientLedgerEntry: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-1" })
      },
      patient: {
        findFirst: jest.fn().mockResolvedValue({ id: "patient-1", branchId: "branch-1" })
      },
      paymentMethod: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(method(where.id)))
      },
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue({ id: "register-1", status: "OPEN" })
      },
      paymentIdempotency: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          ...payment,
          patient: { id: "patient-1", firstName: "Ana", lastName: "Paz", documentNumber: "123" },
          branch: { id: "branch-1", name: "Sucursal" },
          paymentMethod: { id: "cash", name: "Efectivo", type: "CASH" },
          financialInstitution: null,
          receivedBy: { id: "user-1", firstName: "User", lastName: "One" },
          splits: [
            {
              id: "split-1",
              amount: 60,
              paymentMethod: { id: "cash", name: "Efectivo", type: "CASH" },
              financialInstitution: null
            },
            {
              id: "split-2",
              amount: 40,
              paymentMethod: { id: "card", name: "Tarjeta", type: "CARD" },
              financialInstitution: null
            }
          ],
          allocations: [],
          installmentAllocations: [],
          cashMovements: [],
          refunds: []
        })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PaymentsService(prisma as never);

    const result = await service.createPayment(actor, {
      branchId: "branch-1",
      patientId: "patient-1",
      amount: 100,
      splits: [
        { paymentMethodId: "cash", amount: 60 },
        { paymentMethodId: "card", amount: 40, reference: "AUTH-2" }
      ],
      idempotencyKey: "idem-1"
    });

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethodId: "cash",
          paymentNumber: expect.any(Number),
          idempotencyKey: "idem-1"
        })
      })
    );
    expect(tx.paymentMethodSplit.create).toHaveBeenCalledTimes(2);
    expect(tx.cashMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.paymentIdempotency.update).toHaveBeenCalledWith({
      where: { id: "idem-record-1" },
      data: { paymentId: "payment-1", status: "COMPLETED" }
    });
    expect(result.unallocatedAmount).toBe(100);
  });

  it("rejects stale treatment item versions before creating allocations", async () => {
    const tx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payment-1",
          organizationId: "org-1",
          patientId: "patient-1",
          amount: 100,
          allocations: []
        })
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "item-1",
            version: 3,
            total: 100,
            status: "ACCEPTED",
            treatmentPlan: { isAlternative: false }
          }
        ])
      },
      paymentAllocation: {
        groupBy: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };
    const service = new PaymentsService({} as never);
    const staleAllocationService = service as unknown as {
      applyAllocations: (
        txClient: typeof tx,
        currentActor: AuthUser,
        paymentId: string,
        allocations: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>
      ) => Promise<void>;
    };

    await expect(
      staleAllocationService.applyAllocations(tx, actor, "payment-1", [
        { treatmentPlanItemId: "item-1", amount: 50, expectedVersion: 2 }
      ])
    ).rejects.toThrow("El saldo cambió mientras realizabas el cobro");
    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
  });

  it("separates total collection from physical cash for mixed payments and expenses", () => {
    const service = new PaymentsService({} as never) as any;
    const cashMethod = {
      name: "Efectivo",
      type: "CASH",
      includeInPhysicalCashBalance: true,
      includeInClosingSummary: true
    };
    const cardMethod = {
      name: "Tarjeta",
      type: "CARD",
      includeInPhysicalCashBalance: false,
      includeInClosingSummary: true
    };
    const transferMethod = {
      name: "Transferencia",
      type: "TRANSFER",
      includeInPhysicalCashBalance: false,
      includeInClosingSummary: true
    };
    const hiddenMethod = {
      name: "Ajuste interno",
      type: "OTHER",
      includeInPhysicalCashBalance: false,
      includeInClosingSummary: false
    };
    const movements = [
      {
        type: CashMovementType.OPENING,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(100),
        paymentMethod: null
      },
      {
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(400),
        paymentMethod: cashMethod
      },
      {
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(600),
        paymentMethod: cardMethod
      },
      {
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(100),
        paymentMethod: hiddenMethod
      },
      {
        type: CashMovementType.EXPENSE,
        direction: CashMovementDirection.OUT,
        amount: new Prisma.Decimal(300),
        paymentMethod: cashMethod
      },
      {
        type: CashMovementType.EXPENSE,
        direction: CashMovementDirection.OUT,
        amount: new Prisma.Decimal(100),
        paymentMethod: transferMethod
      }
    ];

    expect(service.calculateExpectedClosing(movements)).toBe(200);
    const totals = service.calculateCashRegisterTotals(movements);
    expect(totals).toEqual(
      expect.objectContaining({
        openingTotal: 100,
        incomeTotal: 1100,
        expenseTotal: 400,
        paymentMethodTotals: expect.arrayContaining([
          expect.objectContaining({ name: "Efectivo", amount: 400 }),
          expect.objectContaining({ name: "Tarjeta", amount: 600 })
        ])
      })
    );
    expect(totals.paymentMethodTotals).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Ajuste interno" })])
    );
  });

  it("keeps deferred method receipts separate and requires their total to match the split", async () => {
    const service = new PaymentsService({} as never) as any;
    const split = {
      paymentMethodId: "card",
      amount: new Prisma.Decimal(100),
      financialInstitutionId: undefined,
      reference: undefined,
      scheduledSettlements: [
        { sequence: 1, amount: new Prisma.Decimal(40), dueAt: new Date("2026-08-01"), reference: undefined },
        { sequence: 2, amount: new Prisma.Decimal(50), dueAt: new Date("2026-09-01"), reference: undefined }
      ]
    };

    await expect(
      service.validateScheduledSettlements(
        actor,
        {
          name: "Tarjeta",
          acceptsMultipleSettlements: true,
          requiresReference: false,
          requiresFinancialInstitution: false
        },
        split
      )
    ).rejects.toThrow("debe coincidir con el importe del medio de pago");
  });

  it("rejects deferred receipts for methods without the capability", async () => {
    const service = new PaymentsService({} as never) as any;
    await expect(
      service.validateScheduledSettlements(
        actor,
        {
          name: "Efectivo",
          acceptsMultipleSettlements: false,
          requiresReference: false,
          requiresFinancialInstitution: false
        },
        {
          paymentMethodId: "cash",
          amount: new Prisma.Decimal(100),
          scheduledSettlements: [
            { sequence: 1, amount: new Prisma.Decimal(50), dueAt: new Date("2026-08-01") },
            { sequence: 2, amount: new Prisma.Decimal(50), dueAt: new Date("2026-09-01") }
          ]
        }
      )
    ).rejects.toThrow("no acepta liquidaciones programadas");
  });

  it("does not count voided movements in a cash reconciliation", () => {
    const service = new PaymentsService({} as never) as any;
    const movements = [
      {
        type: CashMovementType.OPENING,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(500),
        paymentMethod: null
      },
      {
        type: CashMovementType.ADJUSTMENT,
        direction: CashMovementDirection.OUT,
        amount: new Prisma.Decimal(100),
        paymentMethod: null
      },
      {
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: new Prisma.Decimal(900),
        paymentMethod: null,
        voidedAt: new Date()
      }
    ];

    expect(service.calculateExpectedClosing(movements)).toBe(400);
  });
});

describe("PaymentsService collection summary", () => {
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

  it("returns payment count and average ticket using only reportable payment methods", async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            amount: 100,
            paidAt: new Date("2026-07-10T12:00:00.000Z"),
            paymentMethodSnapshot: { includeInCollectionReports: true },
            paymentMethod: { includeInCollectionReports: false },
            splits: []
          },
          {
            amount: 100,
            paidAt: new Date("2026-07-10T18:00:00.000Z"),
            paymentMethod: { includeInCollectionReports: true },
            splits: [
              {
                amount: 40,
                includeInCollectionReportsSnapshot: true,
                paymentMethod: { includeInCollectionReports: false }
              },
              {
                amount: 60,
                includeInCollectionReportsSnapshot: false,
                paymentMethod: { includeInCollectionReports: true }
              }
            ]
          },
          {
            amount: 200,
            paidAt: new Date("2026-07-11T12:00:00.000Z"),
            paymentMethodSnapshot: { includeInCollectionReports: false },
            paymentMethod: { includeInCollectionReports: true },
            splits: []
          }
        ])
      }
    };
    const service = new PaymentsService(prisma as never);

    const result = await service.getCollectionSummary(actor, {
      branchId: "branch-1",
      dateFrom: "2026-07-09",
      dateTo: "2026-07-18"
    });

    expect(result).toEqual(
      expect.objectContaining({
        total: 140,
        totalPayments: 2,
        averageTicket: 70,
        byDay: [{ date: "2026-07-10", amount: 140, paymentsCount: 2 }]
      })
    );
  });
});
