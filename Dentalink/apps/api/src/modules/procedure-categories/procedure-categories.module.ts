import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ProcedureCategoriesController } from "./procedure-categories.controller";
import { ProcedureCategoriesService } from "./procedure-categories.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProcedureCategoriesController],
  providers: [ProcedureCategoriesService]
})
export class ProcedureCategoriesModule {}
