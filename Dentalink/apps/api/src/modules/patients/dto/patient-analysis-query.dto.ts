import { IsOptional, IsString } from "class-validator";

export class PatientAnalysisQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
