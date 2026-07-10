import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { AppointmentStatus } from "@prisma/client";

export class CreateAppointmentDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  allowOverbooking?: boolean;
}

export class CreateAppointmentsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAppointmentDto)
  appointments!: CreateAppointmentDto[];

  @IsOptional()
  @IsBoolean()
  autoCreateInitialTreatmentPlan?: boolean;
}
