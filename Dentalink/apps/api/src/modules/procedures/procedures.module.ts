import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ProceduresController } from "./procedures.controller";
import { ProceduresService } from "./procedures.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProceduresController],
  providers: [ProceduresService]
})
export class ProceduresModule {}
