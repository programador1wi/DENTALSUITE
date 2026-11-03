import { Type } from "class-transformer";
import { PhotographicFrequency, PhotographicLinkedEntityType, PhotographicSessionType } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class CreatePhotographicLinkDto {
  @IsEnum(PhotographicLinkedEntityType)
  linkedEntityType!: PhotographicLinkedEntityType;

  @IsString()
  @IsNotEmpty()
  linkedEntityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationshipType?: string;
}

export class CreatePhotographicSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PhotographicSessionType)
  sessionType?: PhotographicSessionType;

  @IsDateString()
  clinicalDate!: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CreatePhotographicLinkDto)
  links?: CreatePhotographicLinkDto[];
}

export class UpdatePhotographicSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PhotographicSessionType)
  sessionType?: PhotographicSessionType;

  @IsOptional()
  @IsDateString()
  clinicalDate?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class VersionedActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class VoidPhotographicRecordDto extends VersionedActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class RemovePhotographicLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class UploadPhotographicImageDto {
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @IsOptional()
  @IsString()
  replaceImageId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class UpdatePhotographicTransformationsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @Type(() => Number)
  @IsInt()
  @Min(-360)
  @Max(360)
  rotation!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropX!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  cropY!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  @Max(1)
  cropWidth!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  @Max(1)
  cropHeight!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(4)
  zoom!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(2)
  brightness!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(2)
  contrast!: number;
}

export class UpdatePhotographicPolicyDto {
  @IsEnum(PhotographicFrequency)
  frequency!: PhotographicFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  customIntervalDays?: number | null;
}

export class DismissPhotographicReminderDto {
  @IsOptional()
  @IsDateString()
  until?: string;
}

export class UpdatePhotographicSlotDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  group?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  rowNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  columnNumber?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  recommendedOrientation?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
