import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  roleId!: string;

  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  primaryBranchId?: string;
}
