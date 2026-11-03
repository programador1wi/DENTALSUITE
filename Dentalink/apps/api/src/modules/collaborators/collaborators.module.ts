import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { CollaboratorsController } from "./collaborators.controller";
import { CollaboratorsService } from "./collaborators.service";

@Module({
  imports: [PrismaModule],
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService]
})
export class CollaboratorsModule {}
