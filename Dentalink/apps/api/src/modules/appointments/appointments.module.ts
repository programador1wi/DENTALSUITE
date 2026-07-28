import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TreatmentPlansModule } from "../treatment-plans/treatment-plans.module";
import { CrmSurveysModule } from "../crm-surveys/crm-surveys.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [PrismaModule, NotificationsModule, TreatmentPlansModule, CrmSurveysModule, JwtModule.register({})],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
