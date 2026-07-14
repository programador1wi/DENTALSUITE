import { TreatmentPlanItemStatus, TreatmentPlanStatus } from "@prisma/client";

export type TreatmentPlanClinicalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_COMPLETE"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export type TreatmentPlanClinicalProgress = {
  eligibleCount: number;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  percentage: number;
  displayPercentage: number;
  hasStarted: boolean;
  readyToComplete: boolean;
};

type ProgressItem = {
  status: TreatmentPlanItemStatus;
  completionPercentage?: number | null;
};

const CLOSED_STATUSES = new Set<TreatmentPlanStatus>([
  TreatmentPlanStatus.CANCELLED,
  TreatmentPlanStatus.REJECTED,
  TreatmentPlanStatus.COMPLETED
]);

export function normalizeTreatmentPlanItemProgress(item: ProgressItem) {
  const explicit = Number(item.completionPercentage);
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, explicit));
  if (item.status === TreatmentPlanItemStatus.COMPLETED) return 100;
  if (item.status === TreatmentPlanItemStatus.IN_PROGRESS) return 25;
  return 0;
}

export function calculateTreatmentPlanClinicalProgress(items: ProgressItem[]): TreatmentPlanClinicalProgress {
  const eligibleItems = items.filter((item) => item.status !== TreatmentPlanItemStatus.CANCELLED);
  const progressValues = eligibleItems.map(normalizeTreatmentPlanItemProgress);
  const eligibleCount = progressValues.length;
  const percentage = eligibleCount
    ? progressValues.reduce((sum, value) => sum + value, 0) / eligibleCount
    : 0;
  const roundedPercentage = Math.round((percentage + Number.EPSILON) * 100) / 100;

  return {
    eligibleCount,
    pendingCount: progressValues.filter((value) => value <= 0).length,
    inProgressCount: progressValues.filter((value) => value > 0 && value < 100).length,
    completedCount: progressValues.filter((value) => value >= 100).length,
    percentage: roundedPercentage,
    displayPercentage: Math.round(roundedPercentage),
    hasStarted: progressValues.some((value) => value > 0),
    readyToComplete: eligibleCount > 0 && progressValues.every((value) => value >= 100)
  };
}

export function resolveTreatmentPlanClinicalStatus(
  planStatus: TreatmentPlanStatus,
  progress: TreatmentPlanClinicalProgress
): TreatmentPlanClinicalStatus {
  if (planStatus === TreatmentPlanStatus.CANCELLED) return "CANCELLED";
  if (planStatus === TreatmentPlanStatus.REJECTED) return "REJECTED";
  if (planStatus === TreatmentPlanStatus.COMPLETED) return "COMPLETED";
  if (progress.readyToComplete) return "READY_TO_COMPLETE";
  if (progress.hasStarted) return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function resolveTreatmentPlanStatusFromClinicalProgress(
  currentStatus: TreatmentPlanStatus,
  progress: TreatmentPlanClinicalProgress
) {
  if (CLOSED_STATUSES.has(currentStatus)) return currentStatus;
  if (progress.hasStarted) return TreatmentPlanStatus.IN_PROGRESS;
  return currentStatus;
}
