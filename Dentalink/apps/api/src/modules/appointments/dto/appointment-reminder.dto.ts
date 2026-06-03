import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export const APPOINTMENT_REMINDER_CHANNELS = ["EMAIL", "WHATSAPP", "PHONE"] as const;
export const APPOINTMENT_REMINDER_STATUSES = ["PENDING", "SENT", "FAILED", "CANCELLED"] as const;

export class CreateAppointmentReminderDto {
  @IsString()
  @IsIn(APPOINTMENT_REMINDER_CHANNELS)
  channel!: (typeof APPOINTMENT_REMINDER_CHANNELS)[number];

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_REMINDER_STATUSES)
  status?: (typeof APPOINTMENT_REMINDER_STATUSES)[number];
}

export class UpdateAppointmentReminderDto {
  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_REMINDER_CHANNELS)
  channel?: (typeof APPOINTMENT_REMINDER_CHANNELS)[number];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_REMINDER_STATUSES)
  status?: (typeof APPOINTMENT_REMINDER_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
