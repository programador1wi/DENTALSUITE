import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import {
  ConsentTemplatesController,
  LegacyConsentTemplatesController,
  PatientConsentsController
} from "./consents/consents.controller";
import { ConsentsService } from "./consents/consents.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    DocumentsController,
    ConsentTemplatesController,
    LegacyConsentTemplatesController,
    PatientConsentsController
  ],
  providers: [DocumentsService, ConsentsService],
  exports: [DocumentsService, ConsentsService]
})
export class DocumentsModule {}
