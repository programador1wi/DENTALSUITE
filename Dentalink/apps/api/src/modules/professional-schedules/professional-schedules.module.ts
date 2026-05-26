import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ProfessionalSchedulesController } from "./professional-schedules.controller";
import { ProfessionalSchedulesService } from "./professional-schedules.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProfessionalSchedulesController],
  providers: [ProfessionalSchedulesService],
  exports: [ProfessionalSchedulesService]
})
export class ProfessionalSchedulesModule {}
