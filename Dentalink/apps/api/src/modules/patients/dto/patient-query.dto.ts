import { IsBooleanString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PatientQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBooleanString()
  hasDebt?: string;

  @IsOptional()
  @IsBooleanString()
  withoutFutureAppointment?: string;

  @IsOptional()
  @IsBooleanString()
  isNew?: string;
}
