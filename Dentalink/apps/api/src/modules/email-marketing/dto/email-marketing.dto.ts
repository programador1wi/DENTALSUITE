import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PreviewMarketingReportDto extends PaginationQueryDto {
  @IsObject()
  parameters!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}

export class CreateSegmentDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  reportCode!: string;

  @IsObject()
  parameters!: Record<string, unknown>;
}

export class ExportMarketingReportDto extends PreviewMarketingReportDto {
  @IsIn(["ALL", "ELIGIBLE", "SELECTED", "INELIGIBLE"])
  scope!: "ALL" | "ELIGIBLE" | "SELECTED" | "INELIGIBLE";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedPatientIds?: string[];
}

export class CreateEmailCampaignDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  preheader?: string;

  @IsString()
  reportCode!: string;

  @IsObject()
  parameters!: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  patientIds!: string[];

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  contentText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @MaxLength(180)
  idempotencyKey!: string;
}

export class UpdateEmailCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  preheader?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  contentText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class TestEmailCampaignDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  patientId?: string;
}

export class ScheduleEmailCampaignDto {
  @IsDateString()
  scheduledAt!: string;
}

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(80)
  category!: string;

  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  preheader?: string;

  @IsString()
  html!: string;

  @IsString()
  text!: string;
}

export class UpdateMarketingSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) campaignCooldownDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) maxRecipientsPerCampaign?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) maxCampaignsPerMonth?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) maxDailyEmails?: number;
  @IsOptional() @IsBoolean() allowAttachments?: boolean;
  @IsOptional() @IsBoolean() allowInlineImages?: boolean;
  @IsOptional() @IsBoolean() requireMarketingConsent?: boolean;
  @IsOptional() @IsBoolean() requireVerifiedDomain?: boolean;
  @IsOptional() @IsString() sendWindowStart?: string;
  @IsOptional() @IsString() sendWindowEnd?: string;
}

export class CreateDomainVerificationDto {
  @IsString()
  @MaxLength(253)
  domain!: string;

  @IsString()
  @MaxLength(160)
  fromName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  fromLocalPart?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

export class EmailWebhookDto {
  @IsString() providerEventId!: string;
  @IsString() providerMessageId!: string;
  @IsString() eventType!: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}
