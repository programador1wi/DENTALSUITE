import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PatientFieldConfigController } from "./patient-field-config.controller";
import { PatientFieldConfigService } from "./patient-field-config.service";

@Module({
  imports: [PrismaModule],
  controllers: [PatientFieldConfigController],
  providers: [PatientFieldConfigService],
  exports: [PatientFieldConfigService]
})
export class PatientFieldConfigModule {}
