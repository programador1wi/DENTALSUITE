import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ChairsController } from "./chairs.controller";
import { ChairsService } from "./chairs.service";

@Module({
  imports: [PrismaModule],
  controllers: [ChairsController],
  providers: [ChairsService]
})
export class ChairsModule {}
