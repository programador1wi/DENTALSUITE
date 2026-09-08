import type { AuthUser } from "../../common/types/auth-user";
import { PaymentMethodsService } from "./payment-methods.service";

describe("PaymentMethodsService", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: ["organization.manage_all"]
  };

  function prismaMock(row: Record<string, unknown>) {
    const paymentMethod = {
      create: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(row)
    };
    const auditLog = { create: jest.fn().mockResolvedValue({ id: "audit-1" }) };
    return {
      paymentMethod,
      auditLog,
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ paymentMethod, auditLog })
      )
    };
  }

  it("persists the reporting rules selected during creation", async () => {
    const prisma = prismaMock({
      id: "method-1",
      publicCode: "PM-TEST",
      source: "CUSTOM",
      name: "Tarjeta",
      type: "CARD",
      retentionPercent: 0,
      version: 1
    });
    const service = new PaymentMethodsService(prisma as never);

    await service.create(actor, {
      name: "  Tarjeta  ",
      type: "CARD",
      includeInCollectionReports: true,
      includeInPhysicalCashBalance: false,
      includeInCashFlowReports: true,
      includeInClosingSummary: false,
      includeInGraphicalReports: false
    });

    expect(prisma.paymentMethod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        name: "Tarjeta",
        type: "CARD",
        includeInCollectionReports: true,
        includeInPhysicalCashBalance: false,
        includeInCashFlowReports: true,
        includeInClosingSummary: false,
        includeInGraphicalReports: false,
        createdById: "user-1",
        updatedById: "user-1"
      })
    });
  });

  it("uses safe reporting defaults when rules are omitted", async () => {
    const prisma = prismaMock({
      id: "method-2",
      publicCode: "PM-CASH",
      source: "CUSTOM",
      name: "Efectivo",
      type: "CASH",
      retentionPercent: 0,
      version: 1
    });
    const service = new PaymentMethodsService(prisma as never);

    await service.create(actor, { name: "Efectivo", type: "CASH" });

    expect(prisma.paymentMethod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        includeInCollectionReports: true,
        includeInPhysicalCashBalance: true,
        includeInCashFlowReports: true,
        includeInClosingSummary: true,
        includeInGraphicalReports: true
      })
    });
  });
});
