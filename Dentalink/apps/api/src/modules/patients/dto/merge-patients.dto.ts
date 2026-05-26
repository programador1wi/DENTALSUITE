import { IsString } from "class-validator";

export class MergePatientsDto {
  @IsString()
  targetPatientId!: string;

  @IsString()
  sourcePatientId!: string;
}
