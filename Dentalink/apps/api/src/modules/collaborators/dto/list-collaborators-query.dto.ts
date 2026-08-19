import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListCollaboratorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(["ALL", "ADMINISTRATIVE", "CLINICAL", "CLINICAL_WITHOUT_ACCESS"])
  kind?: "ALL" | "ADMINISTRATIVE" | "CLINICAL" | "CLINICAL_WITHOUT_ACCESS";

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "LOCKED", "PENDING", "WITHOUT_ACCESS"])
  accessStatus?: "ACTIVE" | "INACTIVE" | "LOCKED" | "PENDING" | "WITHOUT_ACCESS";

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "NOT_APPLICABLE"])
  clinicalStatus?: "ACTIVE" | "INACTIVE" | "NOT_APPLICABLE";
}
