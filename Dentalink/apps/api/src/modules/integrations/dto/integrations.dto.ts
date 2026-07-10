import { Type } from "class-transformer";
import {
  AiRequestStatus,
  AiUseCase,
  CommunicationChannel,
  CommunicationJobStatus,
  DocumentRequirementScope,
  DocumentRequirementStatus,
  ImportJobStatus,
  ImportJobType,
  MessageDeliveryStatus,
  PaymentLinkStatus,
  SurveyStatus,
  SurveyType,
  TelemedicineSessionStatus
} from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListCommunicationJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CommunicationJobStatus)
  status?: CommunicationJobStatus;

  @IsOptional()
  @IsEnum(CommunicationChannel)
  channel?: CommunicationChannel;

  @IsOptional()
  @IsString()
  patientId?: string;
}

export class CreateCommunicationJobDto {
  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsString()
  @MaxLength(180)
  recipient!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateKey?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordMessageDeliveryDto {
  @IsEnum(MessageDeliveryStatus)
  status!: MessageDeliveryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  providerMessageId?: string;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;
}

export class ListSurveysQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SurveyStatus)
  status?: SurveyStatus;

  @IsOptional()
  @IsEnum(SurveyType)
  type?: SurveyType;

  @IsOptional()
  @IsString()
  patientId?: string;
}

export class CreateSurveyDto {
  @IsEnum(SurveyType)
  type!: SurveyType;

  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitSurveyResponseDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ListChatMessagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  threadKey?: string;
}

export class CreateChatMessageDto {
  @IsString()
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  threadKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTelemedicineSessionDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  joinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListTelemedicineSessionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TelemedicineSessionStatus)
  status?: TelemedicineSessionStatus;

  @IsOptional()
  @IsString()
  patientId?: string;
}

export class UpdateTelemedicineStatusDto {
  @IsEnum(TelemedicineSessionStatus)
  status!: TelemedicineSessionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ListImportJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportJobType)
  type?: ImportJobType;

  @IsOptional()
  @IsEnum(ImportJobStatus)
  status?: ImportJobStatus;
}

export class CreateImportJobDto {
  @IsEnum(ImportJobType)
  type!: ImportJobType;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  fileName?: string;

  @IsOptional()
  @IsObject()
  summary?: Record<string, unknown>;
}

export class UpdateImportJobDto {
  @IsOptional()
  @IsEnum(ImportJobStatus)
  status?: ImportJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  successRows?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  errorRows?: number;

  @IsOptional()
  @IsObject()
  summary?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  errors?: Record<string, unknown>;
}

export class ListDocumentRequirementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DocumentRequirementStatus)
  status?: DocumentRequirementStatus;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;
}

export class CreateDocumentRequirementDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(DocumentRequirementScope)
  scope?: DocumentRequirementScope;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  procedureId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  requiredBefore?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SatisfyDocumentRequirementDto {
  @IsOptional()
  @IsString()
  clinicalDocumentId?: string;

  @IsOptional()
  @IsString()
  consentId?: string;

  @IsOptional()
  @IsString()
  fileAttachmentId?: string;
}

export class WaiveDocumentRequirementDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class IngestPaymentWebhookDto {
  @IsString()
  @MaxLength(180)
  eventId!: string;

  @IsString()
  @MaxLength(180)
  eventType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  paymentLinkId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsEnum(PaymentLinkStatus)
  linkStatus?: PaymentLinkStatus;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class ListPaymentWebhookEventsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  paymentLinkId?: string;
}

export class ListAiRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AiUseCase)
  useCase?: AiUseCase;

  @IsOptional()
  @IsEnum(AiRequestStatus)
  status?: AiRequestStatus;

  @IsOptional()
  @IsString()
  patientId?: string;
}

export class CreateAiRequestDto {
  @IsEnum(AiUseCase)
  useCase!: AiUseCase;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}

export class CompleteAiRequestDto {
  @IsObject()
  output!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  confidence?: number;
}
