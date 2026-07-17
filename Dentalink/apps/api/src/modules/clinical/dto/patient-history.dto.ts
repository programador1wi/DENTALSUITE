import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const PATIENT_HISTORY_CATEGORIES = [
  "APPOINTMENTS",
  "TREATMENT_PLANS",
  "BUDGETS",
  "EVOLUTIONS",
  "PROCEDURES",
  "MEDICAL_HISTORY",
  "ODONTOGRAM",
  "PERIODONTOGRAM",
  "PAYMENTS",
  "REFUNDS",
  "BILLING",
  "DOCUMENTS",
  "PRESCRIPTIONS",
  "LABORATORY",
  "ORTHODONTICS",
  "CONSENTS",
  "INSURANCE",
  "COLLABORATIONS"
] as const;

export type PatientHistoryCategory = (typeof PATIENT_HISTORY_CATEGORIES)[number];

export class ListPatientHistoryQueryDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  categories?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  toothId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeAnnulled?: boolean;

  @IsOptional()
  @IsIn(["desc", "asc"])
  order?: "desc" | "asc";

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
