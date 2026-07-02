import { IsDateString, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class PublicAvailabilityQueryDto {
  @IsNotEmpty()
  @IsString()
  branchId!: string;

  @IsNotEmpty()
  @IsString()
  professionalId!: string;

  @IsNotEmpty()
  @IsDateString()
  date!: string;
}

export class PublicPatientDto {
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class PublicCreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  branchId!: string;

  @IsNotEmpty()
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  motive?: string;

  @IsNotEmpty()
  @IsDateString()
  startAt!: string;

  @IsNotEmpty()
  @IsObject()
  patient!: PublicPatientDto;

  @IsOptional()
  @IsString()
  campaignCode?: string;
}
