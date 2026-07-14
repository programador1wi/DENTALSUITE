import { Type } from "class-transformer";
import { PeriodontalPosition, ToothProcedureStatus } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class CreateToothConditionDto {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsString()
  toothNumber!: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @IsString()
  condition!: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateToothProcedureDto {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  procedureId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsString()
  toothNumber!: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsEnum(ToothProcedureStatus)
  status?: ToothProcedureStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateToothProcedureStatusDto {
  @IsEnum(ToothProcedureStatus)
  status!: ToothProcedureStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 25, 50, 75, 100])
  completionPercentage?: number;

  @IsOptional()
  @IsInt()
  expectedVersion?: number;

  @IsOptional()
  @IsBoolean()
  createClinicalEvolution?: boolean;
}

export class ListOdontogramQueryDto {
  @IsOptional()
  @IsString()
  toothNumber?: string;

  @IsOptional()
  @IsString()
  surface?: string;
}

export class CreatePeriodontalMeasurementDto {
  @IsString()
  toothNumber!: string;

  @IsEnum(PeriodontalPosition)
  position!: PeriodontalPosition;

  @IsInt()
  @Min(0)
  @Max(20)
  probingDepth!: number;

  @IsBoolean()
  bleeding!: boolean;

  @IsBoolean()
  plaque!: boolean;

  @IsOptional()
  @IsInt()
  @Min(-8)
  @Max(5)
  recession?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mobility?: number;

  @IsOptional()
  @IsString()
  furcation?: string;

  @IsBoolean()
  suppuration!: boolean;
}

export class CreatePeriodontalChartDto {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsDateString()
  chartDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePeriodontalMeasurementDto)
  measurements!: CreatePeriodontalMeasurementDto[];
}

export class ComparePeriodontalChartsQueryDto {
  @IsString()
  chartAId!: string;

  @IsString()
  chartBId!: string;
}
