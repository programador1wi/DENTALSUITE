import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateBranchDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
