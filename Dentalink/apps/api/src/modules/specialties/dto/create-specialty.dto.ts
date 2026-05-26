import { IsOptional, IsString } from "class-validator";

export class CreateSpecialtyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
