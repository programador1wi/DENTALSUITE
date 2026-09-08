import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export enum ReportExportFormat {
  JSON = "json",
  CSV = "csv",
  XLSX = "xlsx"
}

export class BaseReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(ReportExportFormat)
  format?: ReportExportFormat;
}

export class ProfessionalsReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsString()
  professionalId?: string;
}

export enum ReportsPeriodPreset {
  MONTH = "month",
  LAST_30_DAYS = "last30",
  CUSTOM = "custom"
}

export const chartReportTypes = [
  "results",
  "money-flow",
  "patient-analysis",
  "expenses",
  "professional-efficiency",
  "sales-by-procedure",
  "sales-by-category",
  "budget-capture-efficiency",
  "daily-collection",
  "professional-ranking",
  "delinquent-patients",
  "financing-status",
  "payroll-discount-status",
  "patient-referrals",
  "captured-budgets",
  "sales-book"
] as const;

export type ChartReportType = (typeof chartReportTypes)[number];

export const excelReportTypes = ["appointments", "patients", "treatments", "financial", "professionals"] as const;

export type ExcelReportType = (typeof excelReportTypes)[number];

export const reportRequestStatuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"] as const;

export type ReportRequestStatus = (typeof reportRequestStatuses)[number];

export const reportParameterTypes = [
  "text",
  "select",
  "multiselect",
  "date",
  "dateRange",
  "month",
  "year",
  "number",
  "checkbox",
  "branch",
  "priceList",
  "professional",
  "patient",
  "appointmentStatus",
  "paymentMethod",
  "warehouse",
  "inventoryWarehouse",
  "laboratory",
  "agreement",
  "treatmentCategory"
] as const;

export type ReportParameterType = (typeof reportParameterTypes)[number];

export type ReportParameterDefinition = {
  key: string;
  label: string;
  type: ReportParameterType;
  required?: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{ label: string; value: string }>;
  dependsOn?: string;
  maxRangeDays?: number;
};

export type ReportSurface = "REQUEST" | "PERIOD";
export type ReportTemporalMode = "RANGE" | "MONTH" | "AS_OF" | "CURRENT";

export type ExcelReportDefinition = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  permission: string;
  supportedFormats: Array<Exclude<ReportExportFormat, ReportExportFormat.JSON>>;
  parameters: ReportParameterDefinition[];
  handler: string | null;
  estimatedComplexity?: "LOW" | "MEDIUM" | "HIGH";
  enabled: boolean;
  unavailableReason?: string;
  country?: string;
  plan?: string;
  keywords?: string[];
  surfaces?: ReportSurface[];
  temporalMode?: ReportTemporalMode;
  dateField?: string | null;
  sourceModel?: string;
  requiredPermissions?: string[];
};

export class AnalyticsReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsEnum(ReportsPeriodPreset)
  preset?: ReportsPeriodPreset;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class GenerateChartReportDto extends AnalyticsReportQueryDto {
  @IsOptional()
  @IsString()
  criteria?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsBoolean()
  includeSuggestedBudget?: boolean;
}

export class CreateExcelReportRequestDto extends BaseReportQueryDto {
  @IsOptional()
  @IsIn(excelReportTypes)
  type?: ExcelReportType;

  @IsOptional()
  @IsString()
  reportCode?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(["REQUEST", "PERIOD"])
  surface?: ReportSurface;
}

export type ReportExportPayload = {
  format: Exclude<ReportExportFormat, ReportExportFormat.JSON>;
  fileName: string;
  mimeType: string;
  base64: string;
};

export type ReportResponse<T> = {
  filters: {
    dateFrom: string;
    dateTo: string;
    branchId?: string;
  };
  data: T;
  export?: ReportExportPayload;
};

export class ReportRangeInput {
  @Type(() => Date)
  start!: Date;

  @Type(() => Date)
  end!: Date;
}
