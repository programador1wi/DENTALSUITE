import { PaymentLinkStatus, PaymentStatus, RefundStatus } from "@prisma/client";
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
        groupBy: jest.fn().mockResolvedValue([
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

  it("auto-opens a cash register with zero opening amount when the user can open registers", async () => {
    const actorWithOpenPermission = { ...actor, permissions: ["cash_register.open"] };
    const tx = {
      cashRegister: {
        create: jest.fn().mockResolvedValue({ id: "register-1" })
      },
      cashMovement: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "register-1", status: "OPEN" })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new PaymentsService(prisma as never);

    const register = await (service as any).ensureOpenCashRegister(actorWithOpenPermission, "branch-1");

    expect(register).toEqual({ id: "register-1", status: "OPEN" });
    expect(tx.cashRegister.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: "branch-1",
          openedById: "user-1",
          status: "OPEN"
        })
      })
    );
    expect(tx.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cashRegisterId: "register-1",
          type: "OPENING",
          createdById: "user-1"
        })
      })
    );
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
        findFirst: jest.fn().mockResolvedValue({ id: "method-1" })
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
      paymentMethodSplit: {
        create: jest.fn()
      },
      cashMovement: {
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
        findFirst: jest.fn().mockResolvedValue({ id: "cash", isActive: true })
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
            { id: "split-1", amount: 60, paymentMethod: { id: "cash", name: "Efectivo", type: "CASH" }, financialInstitution: null },
            { id: "split-2", amount: 40, paymentMethod: { id: "card", name: "Tarjeta", type: "CARD" }, financialInstitution: null }
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
});
