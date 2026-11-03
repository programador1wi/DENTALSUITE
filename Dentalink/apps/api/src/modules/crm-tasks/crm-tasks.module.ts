import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { CrmTasksController } from "./crm-tasks.controller";
import { CrmTasksService } from "./crm-tasks.service";

@Module({
  imports: [PrismaModule],
  controllers: [CrmTasksController],
  providers: [CrmTasksService],
  exports: [CrmTasksService]
})
export class CrmTasksModule {}
