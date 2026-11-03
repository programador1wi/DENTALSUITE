import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { OrthodonticProgressService } from "./orthodontic-progress.service";

@Module({
  imports: [PrismaModule],
  providers: [OrthodonticProgressService],
  exports: [OrthodonticProgressService]
})
export class OrthodonticProgressModule {}
