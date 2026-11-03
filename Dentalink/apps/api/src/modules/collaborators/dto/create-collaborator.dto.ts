import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class CollaboratorScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsString()
  breakStartTime?: string;

  @IsOptional()
  @IsString()
  breakEndTime?: string;
}

export class CollaboratorClinicalProfileDto {
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  specialtyIds!: string[];

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10, 15, 20, 30, 45, 60])
  agendaSlotMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  defaultAppointmentDurationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollaboratorScheduleDto)
  schedules?: CollaboratorScheduleDto[];
}

export class CreateCollaboratorDto {
  @IsIn(["ADMINISTRATIVE", "CLINICAL"])
  kind!: "ADMINISTRATIVE" | "CLINICAL";

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  roleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  primaryBranchId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CollaboratorClinicalProfileDto)
  clinicalProfile?: CollaboratorClinicalProfileDto;
}
