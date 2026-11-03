import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PermissionProfilesController } from "./permission-profiles.controller";
import { PermissionProfilesService } from "./permission-profiles.service";

@Module({
  imports: [PrismaModule],
  controllers: [PermissionProfilesController],
  providers: [PermissionProfilesService],
  exports: [PermissionProfilesService]
})
export class PermissionProfilesModule {}
