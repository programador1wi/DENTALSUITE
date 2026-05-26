-- DropIndex
DROP INDEX "Appointment_treatmentPlanId_idx";

-- RenameIndex
ALTER INDEX "PeriodontalMeasurement_periodontalChartId_toothNumber_position_" RENAME TO "PeriodontalMeasurement_periodontalChartId_toothNumber_posit_key";

-- RenameIndex
ALTER INDEX "TreatmentPlanAlternative_parentTreatmentPlanId_alternativeTreat" RENAME TO "TreatmentPlanAlternative_parentTreatmentPlanId_alternativeT_key";
