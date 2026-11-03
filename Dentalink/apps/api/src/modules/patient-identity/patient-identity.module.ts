import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { BookingBotApiKeyGuard } from "./booking-bot-api-key.guard";
import {
  BookingIdentityIntegrationController,
  PatientIdentityController
} from "./patient-identity.controller";
import { PatientIdentityService } from "./patient-identity.service";
import { PhoneNormalizationService } from "./phone-normalization.service";

@Module({
  imports: [PrismaModule, AppointmentsModule],
  controllers: [PatientIdentityController, BookingIdentityIntegrationController],
  providers: [PatientIdentityService, PhoneNormalizationService, BookingBotApiKeyGuard],
  exports: [PatientIdentityService, PhoneNormalizationService]
})
export class PatientIdentityModule {}
