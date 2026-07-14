import { TreatmentPlanItemStatus, TreatmentPlanStatus } from "@prisma/client";
import {
  calculateTreatmentPlanClinicalProgress,
  resolveTreatmentPlanClinicalStatus,
  resolveTreatmentPlanStatusFromClinicalProgress
} from "./treatment-plan-progress";

describe("treatment plan clinical progress", () => {
  it("calculates a simple average from active item progress", () => {
    const progress = calculateTreatmentPlanClinicalProgress([
      { status: TreatmentPlanItemStatus.COMPLETED, completionPercentage: 100 },
      { status: TreatmentPlanItemStatus.IN_PROGRESS, completionPercentage: 50 },
      { status: TreatmentPlanItemStatus.ACCEPTED, completionPercentage: 0 },
      { status: TreatmentPlanItemStatus.IN_PROGRESS, completionPercentage: 25 }
    ]);

    expect(progress.percentage).toBe(43.75);
    expect(progress.displayPercentage).toBe(44);
    expect(progress.pendingCount).toBe(1);
    expect(progress.inProgressCount).toBe(2);
    expect(progress.completedCount).toBe(1);
    expect(progress.hasStarted).toBe(true);
    expect(progress.readyToComplete).toBe(false);
  });

  it("ignores cancelled items when calculating progress", () => {
    const progress = calculateTreatmentPlanClinicalProgress([
      { status: TreatmentPlanItemStatus.COMPLETED, completionPercentage: 100 },
      { status: TreatmentPlanItemStatus.CANCELLED, completionPercentage: 0 }
    ]);

    expect(progress.eligibleCount).toBe(1);
    expect(progress.percentage).toBe(100);
    expect(progress.readyToComplete).toBe(true);
  });

  it("moves clinical state to in progress without completing the plan automatically", () => {
    const progress = calculateTreatmentPlanClinicalProgress([
      { status: TreatmentPlanItemStatus.IN_PROGRESS, completionPercentage: 25 },
      { status: TreatmentPlanItemStatus.ACCEPTED, completionPercentage: 0 }
    ]);

    expect(resolveTreatmentPlanClinicalStatus(TreatmentPlanStatus.ACCEPTED, progress)).toBe("IN_PROGRESS");
    expect(resolveTreatmentPlanStatusFromClinicalProgress(TreatmentPlanStatus.ACCEPTED, progress)).toBe(
      TreatmentPlanStatus.IN_PROGRESS
    );
  });

  it("marks all completed active items as ready to complete, not completed", () => {
    const progress = calculateTreatmentPlanClinicalProgress([
      { status: TreatmentPlanItemStatus.COMPLETED, completionPercentage: 100 },
      { status: TreatmentPlanItemStatus.COMPLETED, completionPercentage: 100 }
    ]);

    expect(resolveTreatmentPlanClinicalStatus(TreatmentPlanStatus.IN_PROGRESS, progress)).toBe("READY_TO_COMPLETE");
    expect(resolveTreatmentPlanStatusFromClinicalProgress(TreatmentPlanStatus.IN_PROGRESS, progress)).toBe(
      TreatmentPlanStatus.IN_PROGRESS
    );
  });

  it("preserves closed plan statuses", () => {
    const progress = calculateTreatmentPlanClinicalProgress([
      { status: TreatmentPlanItemStatus.IN_PROGRESS, completionPercentage: 50 }
    ]);

    expect(resolveTreatmentPlanClinicalStatus(TreatmentPlanStatus.CANCELLED, progress)).toBe("CANCELLED");
    expect(resolveTreatmentPlanStatusFromClinicalProgress(TreatmentPlanStatus.COMPLETED, progress)).toBe(
      TreatmentPlanStatus.COMPLETED
    );
  });
});
