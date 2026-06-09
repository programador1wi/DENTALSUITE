import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class AddPatientNoteDto {
  @IsString()
  note!: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileAttachmentIds?: string[];
}
