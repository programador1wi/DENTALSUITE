import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import {
  CommunicationChannel,
  SurveyDefinitionStatus,
  SurveyQuestionType,
  SurveyType
} from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListSurveyDefinitionsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(SurveyDefinitionStatus) status?: SurveyDefinitionStatus;
  @IsOptional() @IsEnum(SurveyType) type?: SurveyType;
  @IsOptional() @IsString() branchId?: string;
}

export class CreateSurveyDefinitionDto {
  @IsOptional() @IsEnum(SurveyType) type?: SurveyType;
  @IsOptional() @IsString() branchId?: string;
}

export class UpdateSurveyDefinitionDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsEnum(SurveyType) type?: SurveyType;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() @MaxLength(180) emailSubject?: string;
  @IsOptional() @IsString() @MaxLength(100_000) emailHeaderHtml?: string;
  @IsOptional() @IsString() @MaxLength(100_000) emailFooterHtml?: string;
}

export class CreateSurveySectionDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateSurveySectionDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}

export class ReorderSurveyItemsDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) ids!: string[];
}

export class SurveyQuestionOptionDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MaxLength(240) label!: string;
  @IsOptional() @IsString() @MaxLength(120) value?: string;
}

export class CreateSurveyQuestionDto {
  @IsString() @MaxLength(1_000) text!: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsEnum(SurveyQuestionType) type!: SurveyQuestionType;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsObject() validationJson?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionOptionDto)
  options?: SurveyQuestionOptionDto[];
}

export class UpdateSurveyQuestionDto {
  @IsOptional() @IsString() @MaxLength(1_000) text?: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string | null;
  @IsOptional() @IsEnum(SurveyQuestionType) type?: SurveyQuestionType;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsObject() validationJson?: Record<string, unknown>;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionOptionDto)
  options?: SurveyQuestionOptionDto[];
}

export class UpdateSurveySendConfigurationDto {
  @IsString() surveyId!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) professionalIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) appointmentTypes?: string[];
  @IsOptional() @IsEnum(CommunicationChannel) channel?: CommunicationChannel;
  @IsOptional() @IsIn(["APPOINTMENT_COMPLETED"]) triggerEvent?: "APPOINTMENT_COMPLETED";
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(43_200) delayMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) minimumFrequencyDays?: number;
  @IsOptional() @IsString() @MaxLength(5) sendWindowStart?: string;
  @IsOptional() @IsString() @MaxLength(5) sendWindowEnd?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) maxRetries?: number;
  @IsOptional() @IsBoolean() reminderEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(43_200) reminderDelayMinutes?: number | null;
  @IsOptional() @IsBoolean() requireConsent?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SurveyResultsQueryDto {
  @IsOptional() @IsString() surveyId?: string;
  @IsOptional() @IsString() versionId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() professionalId?: string;
  @IsOptional() @IsString() specialtyId?: string;
  @IsOptional() @IsEnum(CommunicationChannel) channel?: CommunicationChannel;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class SurveyPublicAnswerDto {
  @IsString() questionId!: string;
  @IsOptional() @IsString() optionId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) optionIds?: string[];
  @IsOptional() @IsString() @MaxLength(10_000) valueText?: string;
  @IsOptional() @Type(() => Number) @IsNumber() valueNumber?: number;
  @IsOptional() @IsBoolean() valueBoolean?: boolean;
}

export class SubmitPublicSurveyDto {
  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => SurveyPublicAnswerDto)
  answers!: SurveyPublicAnswerDto[];
}

export class RecordSurveyDeliveryDto {
  @IsString() providerMessageId!: string;
  @IsIn(["DELIVERED", "OPENED", "BOUNCED", "FAILED"])
  type!: "DELIVERED" | "OPENED" | "BOUNCED" | "FAILED";
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsEmail() recipient?: string;
}
