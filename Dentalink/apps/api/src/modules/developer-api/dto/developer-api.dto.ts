import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AppointmentStatus, BudgetStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class DeveloperPaginationQueryDto {
  @ApiPropertyOptional({ description: "Numero de pagina (1-indexado)", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Cantidad de registros por pagina (maximo 100)", default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class ListDeveloperPatientsQueryDto extends DeveloperPaginationQueryDto {
  @ApiPropertyOptional({ description: "Termino de busqueda por nombre, apellido, correo o telefono" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filtrar por ID de sucursal" })
  @IsString()
  @IsOptional()
  branchId?: string;
}

export class CreateDeveloperPatientDto {
  @ApiProperty({ description: "Primer nombre del paciente", example: "Carlos" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: "Apellidos del paciente", example: "Hernandez Gomez" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ description: "Correo electronico de contacto", example: "carlos@ejemplo.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: "Telefono de contacto en formato E.164", example: "+529612345678" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "Fecha de nacimiento en formato YYYY-MM-DD", example: "1990-05-15" })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ description: "Genero del paciente (M, F, OTHER)", example: "M" })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: "Numero de identificacion oficial o DNI", example: "HEGC900515HDF" })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({ description: "ID de sucursal de atencion" })
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}

export class ListDeveloperAppointmentsQueryDto extends DeveloperPaginationQueryDto {
  @ApiProperty({ description: "Fecha inicial del rango en ISO 8601", example: "2026-09-01T00:00:00Z" })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ description: "Fecha final del rango en ISO 8601", example: "2026-09-30T23:59:59Z" })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @ApiPropertyOptional({ description: "Filtrar por ID de sucursal" })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Filtrar por ID de paciente" })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: "Filtrar por ID de profesional" })
  @IsString()
  @IsOptional()
  professionalId?: string;

  @ApiPropertyOptional({ description: "Filtrar por estado de cita", enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;
}

export class CreateDeveloperAppointmentDto {
  @ApiProperty({ description: "ID de la sucursal donde se realizara la cita" })
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ description: "ID del paciente agendado" })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: "ID del profesional odontologo" })
  @IsString()
  @IsNotEmpty()
  professionalId!: string;

  @ApiProperty({ description: "Fecha y hora de inicio de la cita en ISO 8601", example: "2026-09-10T10:00:00Z" })
  @IsDateString()
  @IsNotEmpty()
  startAt!: string;

  @ApiProperty({ description: "Fecha y hora de finalizacion de la cita en ISO 8601", example: "2026-09-10T11:00:00Z" })
  @IsDateString()
  @IsNotEmpty()
  endAt!: string;

  @ApiPropertyOptional({ description: "Motivo de la cita", example: "Limpieza y profilaxis" })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: "Notas adicionales" })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: "ID del sillon dental asignado" })
  @IsString()
  @IsOptional()
  chairId?: string;
}

export class ListDeveloperBudgetsQueryDto extends DeveloperPaginationQueryDto {
  @ApiPropertyOptional({ description: "ID de sucursal del plan de tratamiento" })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "ID del paciente para consultar presupuestos" })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: "Estado del presupuesto", enum: BudgetStatus })
  @IsEnum(BudgetStatus)
  @IsOptional()
  status?: BudgetStatus;
}

export class ListDeveloperProceduresQueryDto extends DeveloperPaginationQueryDto {
  @ApiPropertyOptional({ description: "Buscar por nombre o codigo de procedimiento" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "ID de sucursal para consultar precios vigentes" })
  @IsString()
  @IsOptional()
  branchId?: string;
}
