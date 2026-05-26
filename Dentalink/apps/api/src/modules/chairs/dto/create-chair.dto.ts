import { IsOptional, IsString } from "class-validator";

export class CreateChairDto {
  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
