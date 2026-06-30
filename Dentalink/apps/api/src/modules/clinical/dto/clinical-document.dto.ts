import { IsOptional, IsString } from "class-validator";

export class CreateClinicalDocumentTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  content!: string;
}

export class CreateClinicalDocumentDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;
}

export class CreateClinicalDocumentFromTemplateDto {
  @IsString()
  templateId!: string;

  @IsString()
  title!: string;
}

export class DeleteClinicalDocumentDto {
  @IsString()
  reason!: string;
}
