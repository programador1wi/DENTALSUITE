import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { DocumentsModule } from "../documents/documents.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PatientIdentityModule } from "../patient-identity/patient-identity.module";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";

@Module({
  imports: [PrismaModule, DocumentsModule, NotificationsModule, PatientIdentityModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService]
})
export class PatientsModule {}
