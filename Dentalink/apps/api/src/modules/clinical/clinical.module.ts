import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ClinicalController } from "./clinical.controller";
import { ClinicalService } from "./clinical.service";

import { OrthodonticCatalogsController } from "./controllers/orthodontic-catalogs.controller";
import { OrthodonticCatalogsService } from "./services/orthodontic-catalogs.service";

@Module({
  imports: [PrismaModule],
  controllers: [ClinicalController, OrthodonticCatalogsController],
  providers: [ClinicalService, OrthodonticCatalogsService],
  exports: [ClinicalService, OrthodonticCatalogsService]
})
export class ClinicalModule {}
