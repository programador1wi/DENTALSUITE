import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

const DATE_OR_MONTH = /^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;
const TIMEZONE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/;

export class PatientAnalysisQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_OR_MONTH)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_OR_MONTH)
  to?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.flatMap((entry) => String(entry).split(","))
      : String(value)
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
  )
  @IsString({ each: true })
  branchIds?: string[];

  @IsOptional()
  @IsString()
  @Matches(TIMEZONE)
  timezone?: string;

  @IsOptional()
  @IsIn(["auto", "day", "month", "year"])
  granularity?: "auto" | "day" | "month" | "year";

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  metricVersion?: string;
}

export class PatientAnalysisDetailQueryDto extends PatientAnalysisQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order: "asc" | "desc" = "desc";

  @IsOptional()
  @IsString()
  sortBy?: string;
}
