import { Type } from "class-transformer";
import { ConsentStatus } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PatientFilesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
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
}

export class UploadBinaryFileAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;
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

  @IsString()
  @IsNotEmpty()
  content!: string;
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
  @IsString()
  @IsNotEmpty()
  content?: string;

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
