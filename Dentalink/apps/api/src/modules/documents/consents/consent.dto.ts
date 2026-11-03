import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PatientSignerDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  required!: boolean;
}

export class ProfessionalSignerDto extends PatientSignerDto {
  @IsIn(["TREATMENT_PROFESSIONAL", "MANUAL", "ANY_AUTHORIZED"])
  mode!: "TREATMENT_PROFESSIONAL" | "MANUAL" | "ANY_AUTHORIZED";
}

export class RepresentativeSignerDto extends PatientSignerDto {
  @IsBoolean()
  replacesPatient!: boolean;
}

export class RequiredSignersDto {
  @ValidateNested()
  @Type(() => PatientSignerDto)
  patient!: PatientSignerDto;

  @ValidateNested()
  @Type(() => ProfessionalSignerDto)
  professional!: ProfessionalSignerDto;

  @ValidateNested()
  @Type(() => RepresentativeSignerDto)
  representative!: RepresentativeSignerDto;
}

export class ConsentTemplateDraftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  internalDescription?: string;

  @IsIn(["ORGANIZATION", "BRANCHES", "SPECIALTY", "TREATMENTS"])
  scopeType!: "ORGANIZATION" | "BRANCHES" | "SPECIALTY" | "TREATMENTS";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  branchIds?: string[];

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  treatmentTypeIds?: string[];

  @IsObject()
  editorSchemaJson!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => RequiredSignersDto)
  requiredSigners!: RequiredSignersDto;
}

export class UpdateConsentTemplateDraftDto extends ConsentTemplateDraftDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ConsentTemplateListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "INACTIVE", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "INACTIVE" | "ARCHIVED";

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(["ORGANIZATION", "BRANCHES", "SPECIALTY", "TREATMENTS"])
  scopeType?: "ORGANIZATION" | "BRANCHES" | "SPECIALTY" | "TREATMENTS";

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;
}

export class PreviewConsentTemplateDto {
  @IsObject()
  editorSchemaJson!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => RequiredSignersDto)
  requiredSigners!: RequiredSignersDto;
}

export class VersionedActionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class GeneratePatientConsentDto {
  @IsString()
  templateId!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  representativeId?: string;

  @IsOptional()
  @IsString()
  supersedesConsentId?: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}

export class UpdateConsentFieldsDto {
  @IsObject()
  values!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AddConsentSignatureDto {
  @IsIn(["PATIENT", "PROFESSIONAL", "REPRESENTATIVE"])
  signerType!: "PATIENT" | "PROFESSIONAL" | "REPRESENTATIVE";

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  signerName!: string;

  @IsOptional()
  @IsString()
  signerReferenceId?: string;

  @IsIn(["DRAWN", "EXPLICIT_ACCEPTANCE", "SAVED_PROFESSIONAL_SIGNATURE"])
  signatureMethod!: "DRAWN" | "EXPLICIT_ACCEPTANCE" | "SAVED_PROFESSIONAL_SIGNATURE";

  @IsString()
  @IsNotEmpty()
  @MaxLength(3_000_000)
  signatureDataUrl!: string;

  @IsString()
  @MinLength(64)
  @MaxLength(64)
  documentHash!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  acceptanceText!: string;

  @IsString()
  @MaxLength(50)
  acceptanceTextVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class FinalizeConsentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(64)
  @MaxLength(64)
  documentHash!: string;
}

export class VoidConsentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class PatientConsentListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["DRAFT", "READY_FOR_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED", "VOIDED", "EXPIRED", "CANCELLED"])
  status?: string;
}
