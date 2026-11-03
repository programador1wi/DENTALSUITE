import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export enum AppointmentReminderResolution {
  MARK_SENT = "MARK_SENT",
  MARK_NOT_SENT_AND_RETRY = "MARK_NOT_SENT_AND_RETRY"
}

export class AppointmentReminderOperationsQueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsIn(["FIRST_48H", "FINAL_24H"]) stage?: "FIRST_48H" | "FINAL_24H";
  @IsOptional()
  @IsIn(["PENDING", "PROCESSING", "SENT", "FAILED", "UNCERTAIN", "SKIPPED", "EXPIRED", "STALE"])
  status?: string;
  @IsOptional() @IsString() patient?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class UpdateAppointmentReminderPolicyDto {
  @IsBoolean() enabled!: boolean;
  @Type(() => Number) @IsInt() @Min(2) @Max(168) firstOffsetHours!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(167) finalOffsetHours!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1439) sendWindowStartMinutes!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1440) sendWindowEndMinutes!: number;
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(1440, { each: true })
  retryDelaysMinutes!: number[];
  @Type(() => Number) @IsInt() @Min(1) @Max(10) maxAttempts!: number;
}

export class UpdateAppointmentReminderBranchPolicyDto {
  @IsOptional() @IsBoolean() enabled?: boolean | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(168) firstOffsetHours?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(167) finalOffsetHours?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1439) sendWindowStartMinutes?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) sendWindowEndMinutes?: number | null;
}

export class ResolveAppointmentReminderDto {
  @IsEnum(AppointmentReminderResolution) resolution!: AppointmentReminderResolution;
  @IsString() reason!: string;
}

export class TestAppointmentReminderEmailDto {
  @IsOptional() @IsEmail() to?: string;
}
