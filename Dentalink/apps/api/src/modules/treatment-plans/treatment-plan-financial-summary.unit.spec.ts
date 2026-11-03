import { PaymentStatus, TreatmentPlanItemStatus, TreatmentPlanStatus } from "@prisma/client";
import { calculateTreatmentPlanFinancialSummary } from "./treatment-plan-financial-summary.service";

describe("calculateTreatmentPlanFinancialSummary", () => {
  it.each([
    { total: 450, performed: 450, paid: 420, situation: "DEBT", debt: "30.00", assigned: "0.00" },
    {
      total: 38300,
      performed: 9950,
      paid: 10700,
      situation: "AVAILABLE_BALANCE",
      debt: "0.00",
      assigned: "750.00"
    },
    {
      total: 10000,
      performed: 3000,
      paid: 3000,
      situation: "NO_AVAILABLE_BALANCE",
      debt: "0.00",
      assigned: "0.00"
    }
  ])(
    "separates clinical debt from assigned balance",
    ({ total, performed, paid, situation, debt, assigned }) => {
      const summary = calculateTreatmentPlanFinancialSummary({
        id: "plan-1",
        patientId: "patient-1",
        status: TreatmentPlanStatus.IN_PROGRESS,
        items: [
          {
            status: TreatmentPlanItemStatus.IN_PROGRESS,
            total,
            originalPrice: total,
            completionPercentage: Math.round((performed / total) * 100),
            performedAmount: performed,
            paymentAllocations: [
              {
                amount: paid,
                payment: {
                  status: PaymentStatus.ALLOCATED,
                  allocations: [{ amount: paid }],
                  refunds: []
                }
              }
            ]
          }
        ]
      });

      expect(summary.situation.code).toBe(situation);
      expect(summary.debtAmount).toBe(debt);
      expect(summary.assignedBalance).toBe(assigned);
    }
  );

  it("classifies an empty plan as diagnostic", () => {
    const summary = calculateTreatmentPlanFinancialSummary({
      id: "plan-empty",
      patientId: "patient-1",
      status: TreatmentPlanStatus.DRAFT,
      items: []
    });

    expect(summary.situation.code).toBe("DIAGNOSTIC");
  });
});
