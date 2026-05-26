import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
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
