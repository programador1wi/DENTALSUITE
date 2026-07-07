import { Type } from "class-transformer";
import { ConsentStatus, RadiographyAnalysisStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PatientFilesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;
}

export class UploadFileAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  originalName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;

  @IsString()
  @IsUrl({ require_protocol: false })
  url!: string;

  @IsString()
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;
}

export class UploadBinaryFileAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;
}

export class RadiographyFindingBboxDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1)
  width!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1)
  height!: number;
}

export class RadiographyFindingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  tooth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RadiographyFindingBboxDto)
  bbox!: RadiographyFindingBboxDto;

  @IsBoolean()
  visible!: boolean;

  @IsOptional()
  @IsIn(["MANUAL", "AI"])
  source?: "MANUAL" | "AI";
}

export class UpsertRadiographyAnalysisDto {
  @IsOptional()
  @IsEnum(RadiographyAnalysisStatus)
  status?: RadiographyAnalysisStatus;

  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => RadiographyFindingDto)
  findings!: RadiographyFindingDto[];
}

export class ConsentTemplatesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateConsentTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  procedureId?: string;
}

export class UpdateConsentTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsString()
  procedureId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ClinicalDocumentTemplatesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateClinicalDocumentTemplateSettingsDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDefined()
  content!: unknown;
}

export class UpdateClinicalDocumentTemplateSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  content?: unknown;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PatientConsentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;
}

export class CreateConsentDto {
  @IsString()
  templateId!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}

export class SignConsentDto {
  @IsString()
  signerName!: string;

  @IsString()
  signerType!: string;

  @IsString()
  signatureData!: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class DeleteFileAttachmentDto {
  @IsString()
  reason!: string;
}
