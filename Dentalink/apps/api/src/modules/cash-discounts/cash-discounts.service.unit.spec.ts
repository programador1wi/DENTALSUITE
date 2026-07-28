import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { CashDiscountStatus, Prisma, TreatmentPlanItemStatus } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { CashDiscountsService } from "./cash-discounts.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "cashier@example.com",
  firstName: "Cash",
  lastName: "User",
  roleIds: [],
  roleNames: ["CASHIER"],
  permissions: ["payments.cash_discounts.apply", "treatment_discount.apply"],
  branchIds: ["branch-1"]
};

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    publicCode: "DC-000001",
    name: "Liquidacion 50",
    campaign: "Julio",
    version: 1,
    discountPercent: decimal(50),
    status: CashDiscountStatus.ENABLED,
    startsAt: null,
    endsAt: null,
    appliesToClinicalActions: true,
    appliesToLaboratoryActions: false,
    availableToAllUsers: true,
    availableToAllBranches: true,
    stackableWithAgreements: false,
    stackableWithOtherDiscounts: false,
    users: [],
    branches: [],
    ...overrides
  };
}

function treatmentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    version: 3,
    status: TreatmentPlanItemStatus.PLANNED,
    total: decimal(1000),
    discount: decimal(0),
    discountAmount: decimal(0),
    agreementId: null,
    agreementDiscountAmount: null,
    laboratoryCostSnapshot: decimal(0),
    allowsDiscountSnapshot: true,
    maximumDiscountPercentSnapshot: decimal(50),
    paymentAllocations: [],
    procedure: { code: "D1000", name: "Profilaxis", requiresLab: false },
    ...overrides
  };
}

function setup(ruleRow = rule(), itemRows = [treatmentItem()]) {
  const tx = {
    cashDiscountRule: { findFirst: jest.fn().mockResolvedValue(ruleRow) },
    treatmentPlanItem: { findMany: jest.fn().mockResolvedValue(itemRows) }
  };
  const authorization = {
    getUserCapability: jest.fn().mockResolvedValue({
      permissionKeys: actor.permissions,
      maximumDiscountPercent: decimal(100)
    }),
    validateRequestedDiscount: jest.fn().mockResolvedValue({
      userMaximumPercent: decimal(100),
      procedureMaximumPercent: decimal(50),
      effectiveMaximumPercent: decimal(50),
      requestedPercent: decimal(50)
    })
  };
  return {
    tx,
    authorization,
    service: new CashDiscountsService({} as never, authorization as never)
  };
}

const previewDto = {
  branchId: "branch-1",
  treatmentPlanId: "plan-1",
  cashDiscountRuleId: "rule-1",
  items: [{ treatmentPlanItemId: "item-1", outstandingAmount: 1000, expectedVersion: 3 }]
};

describe("CashDiscountsService preview", () => {
  it("uses the complete outstanding balance and returns gross, discount and net snapshots", async () => {
    const { service, tx, authorization } = setup();

    const result = await service.preview(actor, "patient-1", previewDto, tx as never);

    expect(result.originalAmount.toFixed(2)).toBe("1000.00");
    expect(result.discountAmount.toFixed(2)).toBe("500.00");
    expect(result.finalAmount.toFixed(2)).toBe("500.00");
    expect(result.items[0].effectiveMaximum.toFixed(2)).toBe("50.00");
    expect(authorization.validateRequestedDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedPercent: decimal(50),
        procedureAllowsDiscount: true,
        procedureMaximumPercent: decimal(50)
      })
    );
  });

  it("rejects a partial settlement instead of discounting only the requested fragment", async () => {
    const { service, tx } = setup();

    await expect(
      service.preview(
        actor,
        "patient-1",
        { ...previewDto, items: [{ ...previewDto.items[0], outstandingAmount: 500 }] },
        tx as never
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a disabled rule before calculating any item", async () => {
    const { service, tx } = setup(rule({ status: CashDiscountStatus.DISABLED }));

    await expect(service.preview(actor, "patient-1", previewDto, tx as never)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    );
    expect(tx.treatmentPlanItem.findMany).not.toHaveBeenCalled();
  });
});
