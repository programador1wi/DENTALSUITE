import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brandId?: string | null;

  @IsOptional()
  @IsString()
  zoneId?: string | null;

  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  secondaryPhone?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  exteriorNumber?: string | null;

  @IsOptional()
  @IsString()
  interiorNumber?: string | null;

  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  @IsOptional()
  @IsString()
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  municipality?: string | null;

  @IsOptional()
  @IsString()
  references?: string | null;

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
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

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
