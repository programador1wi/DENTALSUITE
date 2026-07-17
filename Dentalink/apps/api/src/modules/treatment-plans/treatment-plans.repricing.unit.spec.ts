import { BadRequestException, ConflictException } from "@nestjs/common";
import { CurrencyCode, TreatmentPlanStatus } from "@prisma/client";
import { TreatmentPlansService } from "./treatment-plans.service";

describe("TreatmentPlansService repricing", () => {
  const actor = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.test",
    firstName: "Ada",
    lastName: "Admin",
    roleIds: [],
    roleNames: [],
    permissions: ["treatment_plans.update"],
    branchIds: ["branch-1"]
  };

  it.each([TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED])(
    "does not recalculate a %s plan",
    async (status) => {
      const service = new TreatmentPlansService({} as never, {} as never);
      jest.spyOn(service, "repricePreview").mockResolvedValue({
        planId: "plan-1",
        status,
        canApply: false,
        requiresRevision: true,
        items: []
      });

      await expect(
        service.repriceApply(
          actor,
          "plan-1",
          { reason: "Refresh draft prices" }
        )
      ).rejects.toBeInstanceOf(ConflictException);
    }
  );

  it("requires an explicit reason before recalculating a draft", async () => {
    const service = new TreatmentPlansService({} as never, {} as never);
    await expect(service.repriceApply(actor, "plan-1", { reason: "   " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("audits before and after price and version snapshots for every repriced item", async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      treatmentPlanItem: { update: jest.fn().mockResolvedValue({}) },
      pricingAuditEvent: { create: auditCreate },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new TreatmentPlansService(prisma as never, {} as never);
    jest.spyOn(service, "repricePreview").mockResolvedValue({
      planId: "plan-1",
      status: TreatmentPlanStatus.DRAFT,
      canApply: true,
      requiresRevision: false,
      items: [
        {
          itemId: "item-1",
          procedureId: "proc-1",
          current: {
            unitPrice: "400.00",
            discount: "0.00",
            total: "400.00",
            versionId: "version-2",
            versionNumber: 2,
            versionItemId: "version-item-2"
          },
          proposed: {
            procedure: { id: "proc-1", code: "PROC-1", name: "Consulta", category: "Diagnostico" },
            priceList: { id: "list-1", code: "BASE", name: "Tarifario Base" },
            version: { id: "version-3", number: 3, itemId: "version-item-3" },
            agreement: null,
            rule: { source: "BASE_PRICE", agreementRuleId: null, manualReason: null },
            basePrice: "500.00",
            appliedPrice: "500.00",
            discountPercent: "0.00",
            discountAmount: "0.00",
            coverageAmount: "0.00",
            copayAmount: "500.00",
            finalPrice: "500.00",
            allowDiscount: true,
            maxDiscountPercent: "100.00",
            currency: CurrencyCode.MXN,
            laboratoryCost: "0.00",
            internalCost: "0.00",
            trace: { branchId: "branch-1", clinicalDate: new Date(), scopeIds: [], correlationId: null },
            pricedAt: new Date(),
            pricedById: actor.id,
            quantity: "1.00",
            total: "500.00"
          },
          difference: "100.00",
          hasFinancialDependencies: false,
          error: null
        }
      ]
    });
    jest.spyOn(service, "getTreatmentPlan").mockResolvedValue({ id: "plan-1" } as never);

    await service.repriceApply(actor, "plan-1", { reason: "Cambio autorizado" });

    const audit = auditCreate.mock.calls[0][0].data;
    expect(audit.reason).toBe("Cambio autorizado");
    expect(audit.oldValue.items[0]).toMatchObject({
      itemId: "item-1",
      versionNumber: 2,
      unitPrice: "400.00",
      total: "400.00"
    });
    expect(audit.newValue.items[0]).toMatchObject({
      itemId: "item-1",
      versionNumber: 3,
      unitPrice: "500.00",
      total: "500.00",
      difference: "100.00"
    });
  });
});
