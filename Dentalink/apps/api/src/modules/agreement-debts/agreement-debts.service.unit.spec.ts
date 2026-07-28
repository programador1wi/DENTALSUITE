import { AgreementChargeStatus, CompanyPaymentStatus, Prisma } from "@prisma/client";
import { AgreementDebtsService } from "./agreement-debts.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.test",
  firstName: "Ada",
  lastName: "Admin",
  roleIds: ["role-1"],
  roleNames: ["ADMIN"],
  permissions: ["system.manage_all"],
  branchIds: ["branch-1", "branch-2"]
};

describe("AgreementDebtsService", () => {
  it("reconciles consolidated and branch debt using confirmed, non-reversed allocations", async () => {
    const prisma = {
      agreement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "agreement-1",
            name: "Convenio Norte",
            companyId: "company-1",
            company: { id: "company-1", legalName: "Empresa Norte" },
            priceList: { currency: "MXN" }
          }
        ])
      },
      agreementCharge: {
        findMany: jest.fn().mockResolvedValue([
          charge("charge-1", "branch-1", 100, [allocation(25)]),
          charge("charge-2", "branch-2", 200, [allocation(50), allocation(20, true)])
        ]),
        count: jest.fn().mockResolvedValue(1)
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: "branch-1", name: "Norte" },
          { id: "branch-2", name: "Sur" }
        ])
      }
    };
    const service = new AgreementDebtsService(prisma as never);

    const report = await service.getDebtReport(actor, {
      cutoffDate: "2026-07-20",
      scope: "ALL",
      page: 1,
      pageSize: 50
    });

    expect(report.consolidated).toHaveLength(1);
    expect(report.byBranch).toHaveLength(2);
    expect(report.consolidated[0]).toMatchObject({
      generatedCharges: 300,
      totalPaid: 75,
      outstandingDebt: 225,
      patientCount: 1,
      chargeCount: 2,
      state: "OUTSTANDING"
    });
    expect(report.totalsByCurrency).toEqual([
      { currency: "MXN", generatedCharges: 300, paid: 75, debt: 225 }
    ]);
    expect(report.reconciliation).toEqual({
      consolidatedDebt: 225,
      branchDebt: 225,
      difference: 0,
      matches: true
    });
    expect(report.diagnostics).toEqual({ futureChargeCount: 1, emptyReason: null });
  });

  it("splits cents without losing or inventing money", () => {
    const service = new AgreementDebtsService({} as never);
    const split = (service as unknown as { splitMoney: (amount: number, count: number) => number[] })
      .splitMoney(100, 3);

    expect(split).toEqual([33.34, 33.33, 33.33]);
    expect(split.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
  });

  it("creates one charge per selected item and installment with agreement snapshots", async () => {
    const tx = {
      payrollDiscountPlan: {
        create: jest.fn().mockResolvedValue({ id: "discount-plan-1", totalAmount: new Prisma.Decimal(150) })
      },
      agreementCharge: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
      payrollDiscount: { create: jest.fn().mockResolvedValue({ id: "legacy-1" }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const prisma = {
      agreement: {
        findFirst: jest.fn().mockResolvedValue({
          id: "agreement-1",
          organizationId: "org-1",
          companyId: "company-1",
          company: { id: "company-1", legalName: "Empresa Norte" },
          name: "Convenio Norte",
          entityTaxId: "XAXX010101000",
          version: 3,
          isActive: true,
          status: "ACTIVE",
          payrollDiscount: true
        })
      },
      treatmentPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: "plan-1",
          patientId: "patient-1",
          branchId: "branch-1",
          patient: { id: "patient-1", firstName: "Ana", lastName: "Pérez", agreementId: "agreement-1" },
          items: [
            item("item-1", 100),
            item("item-2", 50)
          ]
        })
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }) },
      agreementCharge: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx))
    };
    const service = new AgreementDebtsService(prisma as never);

    const result = await service.createPayrollDiscountPlan(
      actor,
      "agreement-1",
      {
        treatmentPlanId: "plan-1",
        treatmentPlanItemIds: ["item-1", "item-2"],
        installmentCount: 2,
        firstDueDate: "2026-08-01",
        periodicity: "MONTHLY"
      },
      { correlationId: "corr-1", ipAddress: "127.0.0.1" }
    );

    expect(result.chargeCount).toBe(4);
    const rows = tx.agreementCharge.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(4);
    expect(rows.reduce((sum: number, row: { originalAmount: Prisma.Decimal }) => sum + Number(row.originalAmount), 0))
      .toBe(150);
    expect(rows.every((row: { agreementSnapshot: { agreementVersion: number } }) => row.agreementSnapshot.agreementVersion === 3))
      .toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "agreement_charge.generate",
          correlationId: "corr-1"
        })
      })
    );
  });
});

function allocation(amount: number, reversed = false) {
  return {
    allocatedAmount: new Prisma.Decimal(amount),
    reversedAt: reversed ? new Date("2026-07-19") : null,
    companyPayment: { status: CompanyPaymentStatus.APPLIED }
  };
}

function charge(id: string, branchId: string, amount: number, allocations: ReturnType<typeof allocation>[]) {
  return {
    id,
    folio: `ADE-${id}`,
    organizationId: "org-1",
    companyId: "company-1",
    agreementId: "agreement-1",
    branchId,
    patientId: "patient-1",
    originalAmount: new Prisma.Decimal(amount),
    paidAmount: new Prisma.Decimal(0),
    outstandingAmount: new Prisma.Decimal(amount),
    currency: "MXN",
    status: AgreementChargeStatus.PENDING,
    dueDate: new Date("2026-07-01"),
    createdAt: new Date("2026-06-01"),
    company: { id: "company-1", legalName: "Empresa Norte" },
    agreement: { id: "agreement-1", name: "Convenio Norte" },
    branch: { id: branchId, name: branchId === "branch-1" ? "Norte" : "Sur" },
    allocations: allocations.filter((row) => !row.reversedAt)
  };
}

function item(id: string, agreementCoverage: number) {
  return {
    id,
    status: "ACCEPTED",
    agreementCoverage: new Prisma.Decimal(agreementCoverage),
    priceCurrency: "MXN",
    procedureCodeSnapshot: `PROC-${id}`,
    procedureNameSnapshot: `Procedimiento ${id}`,
    agreementVersionId: "agreement-version-3",
    agreementVersionNumber: 3,
    agreementNormalPrice: new Prisma.Decimal(agreementCoverage),
    agreementAppliedPrice: new Prisma.Decimal(agreementCoverage),
    procedure: { id: `procedure-${id}`, code: `PROC-${id}`, name: `Procedimiento ${id}` }
  };
}
