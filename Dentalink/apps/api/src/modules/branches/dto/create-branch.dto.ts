import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateBranchDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  exteriorNumber?: string;

  @IsOptional()
  @IsString()
  interiorNumber?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  municipality?: string;

  @IsOptional()
  @IsString()
  references?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  showInEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  showInDocuments?: boolean;

  @IsOptional()
  @IsBoolean()
  showInOnlineScheduling?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOnlineAppointments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNotifications?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([10, 20, 30])
  agendaSlotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  agendaStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  agendaEndHour?: number;
}
