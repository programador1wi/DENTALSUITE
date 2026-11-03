import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateProfessionalAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  roleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  primaryBranchId?: string;
}
