import { DEVELOPER_API_SCOPES } from "@dentalwarner/shared";
import { ApiKeyBranchScope, ApiKeyNetworkScope } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export const API_KEY_DISPLAY_STATUSES = ["ACTIVE", "EXPIRING", "ROTATING", "EXPIRED", "REVOKED"] as const;
export type ApiKeyDisplayStatus = (typeof API_KEY_DISPLAY_STATUSES)[number];

export class CreateApiKeyDto {
  @ApiProperty({ description: "Nombre reconocible de la integracion", example: "Agenda sitio corporativo" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: DEVELOPER_API_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(DEVELOPER_API_SCOPES, { each: true })
  scopes!: string[];

  @ApiProperty({ enum: ApiKeyBranchScope })
  @IsEnum(ApiKeyBranchScope)
  branchScope!: ApiKeyBranchScope;

  @ApiPropertyOptional({ description: "Obligatorio cuando branchScope es SELECTED" })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiProperty({ enum: ApiKeyNetworkScope })
  @IsEnum(ApiKeyNetworkScope)
  networkScope!: ApiKeyNetworkScope;

  @ApiPropertyOptional({ description: "IPv4 o IPv6 exactas; CIDR no es aceptado" })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  allowedIps?: string[];

  @ApiProperty({ enum: [30, 60, 90] })
  @IsInt()
  @IsIn([30, 60, 90])
  expiresInDays!: 30 | 60 | 90;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: DEVELOPER_API_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(DEVELOPER_API_SCOPES, { each: true })
  @IsOptional()
  scopes?: string[];

  @ApiPropertyOptional({ enum: ApiKeyBranchScope })
  @IsEnum(ApiKeyBranchScope)
  @IsOptional()
  branchScope?: ApiKeyBranchScope;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ enum: ApiKeyNetworkScope })
  @IsEnum(ApiKeyNetworkScope)
  @IsOptional()
  networkScope?: ApiKeyNetworkScope;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  allowedIps?: string[];
}

export class ListApiKeysQueryDto {
  @ApiPropertyOptional({ enum: API_KEY_DISPLAY_STATUSES })
  @IsIn(API_KEY_DISPLAY_STATUSES)
  @IsOptional()
  status?: ApiKeyDisplayStatus;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  @IsOptional()
  pageSize = 20;
}
