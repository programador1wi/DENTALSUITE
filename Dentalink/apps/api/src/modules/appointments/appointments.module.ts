import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TreatmentPlansModule } from "../treatment-plans/treatment-plans.module";
import { CrmSurveysModule } from "../crm-surveys/crm-surveys.module";
import { CrmTasksModule } from "../crm-tasks/crm-tasks.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

import { AttendanceAnalyticsService } from "./domain/services/attendance-analytics.service";

@Module({
  imports: [PrismaModule, NotificationsModule, TreatmentPlansModule, CrmSurveysModule, CrmTasksModule, JwtModule.register({})],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AttendanceAnalyticsService],
  exports: [AppointmentsService, AttendanceAnalyticsService]
})
export class AppointmentsModule {}
