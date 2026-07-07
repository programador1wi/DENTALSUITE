import { IsDefined, IsOptional, IsString } from "class-validator";

export class CreateClinicalDocumentTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDefined()
  content!: unknown;
}

export class CreateClinicalDocumentDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsString()
  title!: string;

  @IsDefined()
  content!: unknown;
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
