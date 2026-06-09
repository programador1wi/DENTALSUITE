import { RefundStatus } from "@prisma/client";
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
});
