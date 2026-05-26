import { IsOptional, IsString } from "class-validator";

export class CreatePermissionDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  name?: string;

  // Backward-compatible alias for key.
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  module!: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  description?: string;

}
