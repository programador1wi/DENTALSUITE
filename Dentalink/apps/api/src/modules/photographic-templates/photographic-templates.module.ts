import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import {
  MobilePhotographicUploadsController,
  PhotographicTemplatesController
} from "./photographic-templates.controller";
import { PhotographicImageStorage } from "./photographic-image.storage";
import { PhotographicTemplatesService } from "./photographic-templates.service";

@Module({
  imports: [PrismaModule],
  controllers: [PhotographicTemplatesController, MobilePhotographicUploadsController],
  providers: [PhotographicTemplatesService, PhotographicImageStorage],
  exports: [PhotographicTemplatesService]
})
export class PhotographicTemplatesModule {}
