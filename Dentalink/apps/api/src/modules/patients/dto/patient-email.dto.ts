import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { CommunicationJobStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListPatientEmailsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsEnum(CommunicationJobStatus)
  status?: CommunicationJobStatus;

  @IsOptional()
  @IsString()
  filter?: "all" | "sent" | "queued" | "failed" | "cancelled" | "draft" | "withFiles";
}

export class SendPatientEmailDto {
  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MaxLength(60000)
  bodyHtmlBase64!: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  copyToSender?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  fileAttachmentIds?: string[];
}
