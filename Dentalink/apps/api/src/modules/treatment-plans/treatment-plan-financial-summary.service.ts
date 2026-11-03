import { Injectable, NotFoundException } from "@nestjs/common";
import {
  PaymentStatus,
  Prisma,
  RefundStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";

export type TreatmentPlanFinancialSituationCode =
  | "DEBT"
  | "AVAILABLE_BALANCE"
  | "DIAGNOSTIC"
  | "NO_AVAILABLE_BALANCE"
  | "CANCELLED";

export type TreatmentPlanFinancialSummary = {
  treatmentPlanId: string;
  currency: string;
  recognitionPolicy: "PROPORTIONAL";
  billableItemCount: number;
  grossBudgetAmount: string;
  discountAmount: string;
  budgetAmount: string;
  recognizedAmount: string;
  paidAmount: string;
  settlementDiscountAmount: string;
  settledAmount: string;
  outstandingAmount: string;
  debtAmount: string;
  assignedBalance: string;
  freeCreditAmount: string;
  refundedAmount: string;
  situation: {
    code: TreatmentPlanFinancialSituationCode;
    label: string;
    severity: "danger" | "success" | "warning" | "neutral";
    amount: string | null;
  };
};

type FinancialPayment = {
  status: PaymentStatus;
  allocations?: Array<{ amount: Prisma.Decimal | string | number }>;
  refunds?: Array<{ amount: Prisma.Decimal | string | number; status?: RefundStatus }>;
};

type FinancialPlanInput = {
  id: string;
  status: TreatmentPlanStatus;
  patientId: string;
  items: Array<{
    status: TreatmentPlanItemStatus;
    total: Prisma.Decimal | string | number;
    originalPrice?: Prisma.Decimal | string | number | null;
    discount?: Prisma.Decimal | string | number | null;
    discountAmount?: Prisma.Decimal | string | number | null;
    completionPercentage?: number | null;
    performedAmount?: Prisma.Decimal | string | number | null;
    priceCurrency?: string | null;
    paymentAllocations?: Array<{
      amount: Prisma.Decimal | string | number;
      settlementDiscountAmount?: Prisma.Decimal | string | number | null;
      payment: FinancialPayment;
    }>;
  }>;
};

const ZERO = new Prisma.Decimal(0);

function decimal(value: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function processedRefundAmount(payment: FinancialPayment) {
  return (payment.refunds ?? []).reduce((sum, refund) => {
    if (refund.status && refund.status !== RefundStatus.PROCESSED) return sum;
    return sum.plus(refund.amount);
  }, new Prisma.Decimal(0));
}

function allocationRefundShare(allocationAmount: Prisma.Decimal, payment: FinancialPayment) {
  if (payment.status === PaymentStatus.VOIDED) return ZERO;
  if (payment.status === PaymentStatus.REFUNDED) return allocationAmount;

  const refunded = processedRefundAmount(payment);
  if (refunded.lte(0)) return ZERO;
  const allocatedOnPayment = (payment.allocations ?? []).reduce(
    (sum, allocation) => sum.plus(allocation.amount),
    new Prisma.Decimal(0)
  );
  if (allocatedOnPayment.lte(0)) return ZERO;
  return Prisma.Decimal.min(allocationAmount, refunded.mul(allocationAmount).div(allocatedOnPayment));
}

export function calculateTreatmentPlanFinancialSummary(
  plan: FinancialPlanInput,
  freeCreditAmount: Prisma.Decimal = ZERO
): TreatmentPlanFinancialSummary {
  let grossBudget = new Prisma.Decimal(0);
  let budget = new Prisma.Decimal(0);
  let recognized = new Prisma.Decimal(0);
  let paid = new Prisma.Decimal(0);
  let settlementDiscount = new Prisma.Decimal(0);
  let refunded = new Prisma.Decimal(0);
  let billableItemCount = 0;
  let currency = "MXN";

  for (const item of plan.items) {
    if (item.status === TreatmentPlanItemStatus.CANCELLED) continue;
    const itemTotal = decimal(item.total);
    const snapshotGross = decimal(item.originalPrice);
    const fallbackGross = itemTotal.plus(decimal(item.discountAmount ?? item.discount));
    grossBudget = grossBudget.plus(snapshotGross.gt(0) ? snapshotGross : fallbackGross);
    budget = budget.plus(itemTotal);
    if (itemTotal.gt(0)) billableItemCount += 1;
    if (item.priceCurrency) currency = item.priceCurrency;

    const percentage = Math.min(100, Math.max(0, Number(item.completionPercentage ?? 0)));
    const storedPerformed = decimal(item.performedAmount);
    recognized = recognized.plus(
      storedPerformed.gt(0) || percentage === 0
        ? Prisma.Decimal.min(itemTotal, storedPerformed)
        : itemTotal.mul(percentage).div(100)
    );

    for (const allocation of item.paymentAllocations ?? []) {
      if (allocation.payment.status === PaymentStatus.VOIDED) continue;
      const allocationAmount = decimal(allocation.amount);
      const refundShare = allocationRefundShare(allocationAmount, allocation.payment);
      refunded = refunded.plus(refundShare);
      paid = paid.plus(Prisma.Decimal.max(ZERO, allocationAmount.minus(refundShare)));
      if (allocation.payment.status !== PaymentStatus.REFUNDED) {
        settlementDiscount = settlementDiscount.plus(allocation.settlementDiscountAmount ?? 0);
      }
    }
  }

  const discount = Prisma.Decimal.max(ZERO, grossBudget.minus(budget));
  const settled = paid.plus(settlementDiscount);
  const outstanding = Prisma.Decimal.max(ZERO, budget.minus(settled));
  const debt = Prisma.Decimal.max(ZERO, recognized.minus(settled));
  const assignedBalance = Prisma.Decimal.max(ZERO, paid.minus(recognized));

  let situation: TreatmentPlanFinancialSummary["situation"];
  if (plan.status === TreatmentPlanStatus.CANCELLED || plan.status === TreatmentPlanStatus.REJECTED) {
    situation = { code: "CANCELLED", label: "Cancelado", severity: "neutral", amount: null };
  } else if (debt.gt(0)) {
    situation = { code: "DEBT", label: "Deudas", severity: "danger", amount: money(debt) };
  } else if (assignedBalance.gt(0)) {
    situation = {
      code: "AVAILABLE_BALANCE",
      label: "Hay saldo",
      severity: "success",
      amount: money(assignedBalance)
    };
  } else if (billableItemCount === 0) {
    situation = { code: "DIAGNOSTIC", label: "Diagnóstico", severity: "success", amount: null };
  } else {
    situation = {
      code: "NO_AVAILABLE_BALANCE",
      label: "No hay saldo",
      severity: "warning",
      amount: money(ZERO)
    };
  }

  return {
    treatmentPlanId: plan.id,
    currency,
    recognitionPolicy: "PROPORTIONAL",
    billableItemCount,
    grossBudgetAmount: money(grossBudget),
    discountAmount: money(discount),
    budgetAmount: money(budget),
    recognizedAmount: money(recognized),
    paidAmount: money(paid),
    settlementDiscountAmount: money(settlementDiscount),
    settledAmount: money(settled),
    outstandingAmount: money(outstanding),
    debtAmount: money(debt),
    assignedBalance: money(assignedBalance),
    freeCreditAmount: money(freeCreditAmount),
    refundedAmount: money(refunded),
    situation
  };
}

@Injectable()
export class TreatmentPlanFinancialSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateForPlan(actor: AuthUser, treatmentPlanId: string) {
    const summaries = await this.calculateBatch(actor, [treatmentPlanId]);
    const summary = summaries.get(treatmentPlanId);
    if (!summary) throw new NotFoundException("Treatment plan not found");
    return summary;
  }

  async calculateBatch(actor: AuthUser, treatmentPlanIds: string[]) {
    const ids = [...new Set(treatmentPlanIds.filter(Boolean))];
    if (!ids.length) return new Map<string, TreatmentPlanFinancialSummary>();

    const plans = await this.prisma.treatmentPlan.findMany({
      where: {
        id: { in: ids },
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      },
      select: {
        id: true,
        status: true,
        patientId: true,
        items: {
          select: {
            status: true,
            total: true,
            originalPrice: true,
            discount: true,
            discountAmount: true,
            completionPercentage: true,
            performedAmount: true,
            priceCurrency: true,
            paymentAllocations: {
              select: {
                amount: true,
                settlementDiscountAmount: true,
                payment: {
                  select: {
                    status: true,
                    allocations: { select: { amount: true } },
                    refunds: {
                      where: { status: RefundStatus.PROCESSED },
                      select: { amount: true, status: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const patientIds = [...new Set(plans.map((plan) => plan.patientId))];
    const payments = patientIds.length
      ? await this.prisma.payment.findMany({
          where: {
            organizationId: actor.organizationId,
            branchId: branchScope(actor),
            patientId: { in: patientIds },
            status: { not: PaymentStatus.VOIDED }
          },
          select: {
            patientId: true,
            amount: true,
            status: true,
            allocations: { select: { amount: true } },
            refunds: {
              where: { status: RefundStatus.PROCESSED },
              select: { amount: true }
            }
          }
        })
      : [];

    const freeCreditByPatient = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      if (payment.status === PaymentStatus.REFUNDED) continue;
      const allocated = payment.allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0)
      );
      const refundedAmount = payment.refunds.reduce(
        (sum, refund) => sum.plus(refund.amount),
        new Prisma.Decimal(0)
      );
      const available = Prisma.Decimal.max(ZERO, payment.amount.minus(allocated).minus(refundedAmount));
      freeCreditByPatient.set(
        payment.patientId,
        (freeCreditByPatient.get(payment.patientId) ?? new Prisma.Decimal(0)).plus(available)
      );
    }

    return new Map(
      plans.map((plan) => [
        plan.id,
        calculateTreatmentPlanFinancialSummary(
          plan,
          freeCreditByPatient.get(plan.patientId) ?? new Prisma.Decimal(0)
        )
      ])
    );
  }
}
