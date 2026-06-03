import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAppointmentNoteDto {
  @IsString()
  @MinLength(1)
  note!: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
