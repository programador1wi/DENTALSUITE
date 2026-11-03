import { PartialType } from "@nestjs/swagger";
import { CreateProfessionalSpecialScheduleDto } from "./create-professional-special-schedule.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateProfessionalSpecialScheduleDto extends PartialType(CreateProfessionalSpecialScheduleDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
