import { Type } from "class-transformer";
import { CollectionCaseStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListCollectionCasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(CollectionCaseStatus)
  status?: CollectionCaseStatus;
}

export class DetectOverdueCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDaysOverdue?: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateCollectionCaseDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  installmentId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @Type(() => Number)
  @IsPositive()
  amountDue!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  daysOverdue!: number;

  @IsOptional()
  @IsEnum(CollectionCaseStatus)
  status?: CollectionCaseStatus;

  @IsString()
  assignedToId!: string;

  @IsOptional()
  @IsDateString()
  lastContactAt?: string;

  @IsOptional()
  @IsDateString()
  nextContactAt?: string;
}

export class AddCollectionActivityDto {
  @IsString()
  @MaxLength(80)
  channel!: string;

  @IsString()
  @MaxLength(120)
  result!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string;
}

export class UpdateCollectionCaseStatusDto {
  @IsEnum(CollectionCaseStatus)
  status!: CollectionCaseStatus;
}

export class AssignCollectionCaseDto {
  @IsString()
  assignedToId!: string;
}
