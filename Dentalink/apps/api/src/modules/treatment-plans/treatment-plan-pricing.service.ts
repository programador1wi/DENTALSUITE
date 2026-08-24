import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BudgetStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  TreatmentPriceSource
} from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { RepriceTreatmentPlanDto } from "./dto/treatment-plan.dto";

@Injectable()
export class TreatmentPlanPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing?: PricingService
  ) {}

  async repricePreview(actor: AuthUser, treatmentPlanId: string, dto: RepriceTreatmentPlanDto) {
    if (!this.pricing || process.env.PRICE_LISTS_V2_ENABLED !== "true") {
      throw new BadRequestException("Versioned pricing is disabled");
    }
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        items: {
          where: {
            status: { not: TreatmentPlanItemStatus.CANCELLED },
            ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {})
          },
          include: { paymentAllocations: true, budgetItems: { include: { budget: true } } }
        }
      }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    const results = [];
    for (const item of plan.items) {
      try {
        const price = await this.pricing.resolve(actor, {
          branchId: plan.branchId,
          patientId: plan.patientId,
          planId: plan.id,
          procedureId: item.procedureId,
          clinicalDate: dto.clinicalDate,
          agreementId: plan.agreementId ?? undefined,
          currency: item.priceCurrency
        });
        const quantity = new Prisma.Decimal(item.quantity);
        const newTotal = new Prisma.Decimal(price.finalPrice).mul(quantity).toDecimalPlaces(2);
        results.push({
          itemId: item.id,
          procedureId: item.procedureId,
          current: {
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            total: item.total.toFixed(2),
            versionId: item.priceListVersionId,
            versionNumber: item.priceListVersionNumber,
            versionItemId: item.priceListVersionItemId
          },
          proposed: { ...price, quantity: quantity.toFixed(2), total: newTotal.toFixed(2) },
          difference: newTotal.sub(item.total).toFixed(2),
          hasFinancialDependencies:
            item.paymentAllocations.length > 0 ||
            item.budgetItems.some((budgetItem) => budgetItem.budget.status !== BudgetStatus.DRAFT),
          error: null
        });
      } catch (error) {
        results.push({
          itemId: item.id,
          procedureId: item.procedureId,
          current: {
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            total: item.total.toFixed(2)
          },
          proposed: null,
          difference: null,
          hasFinancialDependencies: item.paymentAllocations.length > 0 || item.budgetItems.length > 0,
          error: error instanceof Error ? error.message : "Price resolution failed"
        });
      }
    }
    return {
      planId: plan.id,
      status: plan.status,
      canApply:
        plan.status === TreatmentPlanStatus.DRAFT &&
        results.every((result) => !result.error && !result.hasFinancialDependencies),
      requiresRevision: plan.status !== TreatmentPlanStatus.DRAFT,
      items: results
    };
  }

  async applyRepricedItems(
    actor: AuthUser,
    treatmentPlanId: string,
    reason: string,
    preview: { items: any[] }
  ) {
    const pricedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const row of preview.items) {
        if (!row.proposed) continue;
        const quantity = new Prisma.Decimal(row.proposed.quantity);
        const normalTotal = new Prisma.Decimal(row.proposed.basePrice).mul(quantity).toDecimalPlaces(2);
        const finalTotal = new Prisma.Decimal(row.proposed.total);
        const discountAmount = normalTotal.sub(finalTotal).toDecimalPlaces(2);
        await tx.treatmentPlanItem.update({
          where: { id: row.itemId },
          data: {
            unitPrice: new Prisma.Decimal(row.proposed.basePrice),
            discount: discountAmount,
            total: finalTotal,
            originalPrice: normalTotal,
            allowsDiscountSnapshot: row.proposed.allowDiscount,
            maximumDiscountPercentSnapshot: new Prisma.Decimal(row.proposed.maxDiscountPercent),
            discountType: discountAmount.gt(0) ? "AMOUNT" : null,
            discountValue: discountAmount.gt(0) ? discountAmount : null,
            discountAmount,
            finalPrice: finalTotal,
            discountAuthorizedBy: discountAmount.gt(0) ? actor.id : null,
            discountedAt: discountAmount.gt(0) ? pricedAt : null,
            appliedDiscountPercent: 0,
            userMaximumDiscountSnapshot: 0,
            effectiveMaximumDiscountSnapshot: 0,
            priceListId: row.proposed.priceList.id,
            priceListItemId: null,
            priceListVersionId: row.proposed.version.id,
            priceListVersionNumber: row.proposed.version.number,
            priceListVersionItemId: row.proposed.version.itemId,
            priceSource: TreatmentPriceSource.PRICE_LIST,
            priceSnapshotName: row.proposed.priceList.name,
            priceSnapshotCode: row.proposed.procedure.code,
            priceSnapshotCategory: row.proposed.procedure.category,
            procedureCodeSnapshot: row.proposed.procedure.code,
            procedureNameSnapshot: row.proposed.procedure.name,
            procedureCategorySnapshot: row.proposed.procedure.category,
            priceListNameSnapshot: row.proposed.priceList.name,
            priceResolvedAt: pricedAt,
            priceCurrency: row.proposed.currency,
            laboratoryCostSnapshot: new Prisma.Decimal(row.proposed.laboratoryCost),
            internalCostSnapshot: new Prisma.Decimal(row.proposed.internalCost),
            pricingRuleSnapshot: row.proposed.rule as Prisma.InputJsonValue,
            pricedById: actor.id,
            agreementId: row.proposed.agreement?.id,
            agreementVersionId: row.proposed.agreement?.versionId,
            agreementVersionNumber: row.proposed.agreement?.version,
            agreementSnapshot: row.proposed.agreement
              ? ({ ...row.proposed.agreement, rule: row.proposed.rule } as Prisma.InputJsonValue)
              : undefined,
            agreementNormalPrice: row.proposed.agreement ? new Prisma.Decimal(row.proposed.basePrice) : null,
            agreementAppliedPrice: row.proposed.agreement
              ? new Prisma.Decimal(row.proposed.finalPrice)
              : null,
            agreementDiscountAmount: row.proposed.agreement
              ? new Prisma.Decimal(row.proposed.discountAmount)
              : null,
            agreementCoverage: new Prisma.Decimal(row.proposed.coverageAmount),
            version: { increment: 1 }
          }
        });
      }
      await tx.pricingAuditEvent.create({
        data: {
          organizationId: actor.organizationId,
          branchId: preview.items[0]?.proposed?.trace?.branchId,
          actorUserId: actor.id,
          entity: "TreatmentPlan",
          entityId: treatmentPlanId,
          action: "treatment_plan.repriced",
          reason,
          oldValue: {
            items: preview.items.map((item) => ({
              itemId: item.itemId,
              procedureId: item.procedureId,
              ...item.current
            }))
          },
          newValue: {
            pricedAt,
            items: preview.items.map((item) => ({
              itemId: item.itemId,
              procedureId: item.procedureId,
              versionId: item.proposed?.version?.id ?? null,
              versionNumber: item.proposed?.version?.number ?? null,
              versionItemId: item.proposed?.version?.itemId ?? null,
              unitPrice: item.proposed?.basePrice ?? null,
              discount: item.proposed?.discountAmount ?? null,
              total: item.proposed?.total ?? null,
              difference: item.difference
            }))
          },
          metadata: {
            priceListIds: [
              ...new Set(
                preview.items
                  .map((item) => item.proposed?.priceList?.id)
                  .filter((id): id is string => Boolean(id))
              )
            ]
          }
        }
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: actor.organizationId,
          aggregateType: "TreatmentPlan",
          aggregateId: treatmentPlanId,
          eventType: "treatment_plan.repriced",
          payload: { itemIds: preview.items.map((item) => item.itemId), pricedAt, actorUserId: actor.id }
        }
      });
    });
  }
}
