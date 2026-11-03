import { ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { DiscountAuthorizationService } from "./discount-authorization.service";

const actor = { id: "user-1", organizationId: "org-1" };

function user(maximum: string | null, hasPermission = true, active = true) {
  const permission = {
    permission: {
      key: "treatment_discount.apply",
      isActive: true,
      deletedAt: null
    }
  };
  return {
    id: actor.id,
    isActive: active,
    status: active ? UserStatus.ACTIVE : UserStatus.INACTIVE,
    discountPolicy:
      maximum === null
        ? null
        : {
            maximumDiscountPercent: new Prisma.Decimal(maximum),
            active: true,
            version: 1
          },
    permissions: [],
    role: { permissions: hasPermission ? [permission] : [] },
    roles: []
  };
}

describe("DiscountAuthorizationService", () => {
  const createService = (row: ReturnType<typeof user>) => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(row) } };
    return new DiscountAuthorizationService(prisma as never);
  };

  it("uses MIN when user maximum is 100 and procedure maximum is 50", async () => {
    const result = await createService(user("100")).validateRequestedDiscount({
      actor,
      procedureAllowsDiscount: true,
      procedureMaximumPercent: "50",
      requestedPercent: "50"
    });

    expect(result.effectiveMaximumPercent.toFixed(2)).toBe("50.00");
    expect(result.requestedPercent.toFixed(2)).toBe("50.00");
  });

  it("rejects 0.01 above procedure maximum without silently clamping", async () => {
    await expect(
      createService(user("100")).validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: true,
        procedureMaximumPercent: "50",
        requestedPercent: "50.01"
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DISCOUNT_EXCEEDS_EFFECTIVE_MAXIMUM" })
    });
  });

  it("uses user maximum when it is lower than procedure maximum", async () => {
    const result = await createService(user("30")).validateRequestedDiscount({
      actor,
      procedureAllowsDiscount: true,
      procedureMaximumPercent: "50",
      requestedPercent: "25"
    });
    expect(result.effectiveMaximumPercent.toFixed(2)).toBe("30.00");
  });

  it("rejects users without permission", async () => {
    await expect(
      createService(user("100", false)).validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: true,
        procedureMaximumPercent: "50",
        requestedPercent: "10"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects missing user maximum", async () => {
    await expect(
      createService(user(null)).validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: true,
        procedureMaximumPercent: "50",
        requestedPercent: "10"
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects a procedure that does not allow discounts", async () => {
    await expect(
      createService(user("100")).validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: false,
        procedureMaximumPercent: "50",
        requestedPercent: "10"
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROCEDURE_DOES_NOT_ALLOW_DISCOUNT" })
    });
  });

  it("rejects negative and above 100 values", async () => {
    const service = createService(user("100"));
    await expect(
      service.validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: true,
        procedureMaximumPercent: "100",
        requestedPercent: "-0.01"
      })
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "DISCOUNT_BELOW_ZERO" }) });
    await expect(
      service.validateRequestedDiscount({
        actor,
        procedureAllowsDiscount: true,
        procedureMaximumPercent: "100",
        requestedPercent: "100.01"
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DISCOUNT_ABOVE_ONE_HUNDRED" })
    });
  });
});
