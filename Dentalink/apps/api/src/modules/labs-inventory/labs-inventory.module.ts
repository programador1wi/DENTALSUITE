import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { LabsInventoryController } from "./labs-inventory.controller";
import { LabsInventoryService } from "./labs-inventory.service";

@Module({
  imports: [PrismaModule],
  controllers: [LabsInventoryController],
  providers: [LabsInventoryService],
  exports: [LabsInventoryService]
})
export class LabsInventoryModule {}
