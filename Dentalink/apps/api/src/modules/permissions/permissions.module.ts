import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PermissionsController } from "./permissions.controller";
import { PermissionsService } from "./permissions.service";

@Module({
  imports: [PrismaModule],
  controllers: [PermissionsController],
  providers: [PermissionsService]
})
export class PermissionsModule {}
