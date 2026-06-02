import { Type } from "class-transformer";
import { IsBoolean, IsISO8601, IsOptional, IsString } from "class-validator";

export class TransferProfessionalBranchDto {
  @IsString()
  branchId!: string;

  @IsString()
  fromProfessionalId!: string;

  @IsString()
  toProfessionalId!: string;

  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  moveFutureAppointments?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  moveFutureBlocks?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  copySchedules?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  copyAgendaConfig?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  endSourceAssignment?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
