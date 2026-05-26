import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { SpecialtiesController } from "./specialties.controller";
import { SpecialtiesService } from "./specialties.service";

@Module({
  imports: [PrismaModule],
  controllers: [SpecialtiesController],
  providers: [SpecialtiesService],
  exports: [SpecialtiesService]
})
export class SpecialtiesModule {}
