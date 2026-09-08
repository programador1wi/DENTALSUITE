import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TreatmentPlansModule } from "../treatment-plans/treatment-plans.module";
import { CrmSurveysModule } from "../crm-surveys/crm-surveys.module";
import { CrmTasksModule } from "../crm-tasks/crm-tasks.module";
import { MetricsModule } from "../metrics/metrics.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { APPOINTMENT_EMAIL_DISPATCHER, AppointmentReminderWorker } from "./appointment-reminder.worker";
import { AppointmentReminderOperationsService } from "./appointment-reminder-operations.service";
import {
  AppointmentReminderOperationsController,
  AppointmentReminderSettingsController
} from "./appointment-reminder-operations.controller";
import { AttendanceAnalyticsService } from "./application/attendance-analytics.service";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MetricsModule,
    TreatmentPlansModule,
    CrmSurveysModule,
    CrmTasksModule,
    JwtModule.register({})
  ],
  controllers: [
    AppointmentsController,
    AppointmentReminderOperationsController,
    AppointmentReminderSettingsController
  ],
  providers: [
    AppointmentsService,
    { provide: APPOINTMENT_EMAIL_DISPATCHER, useExisting: AppointmentsService },
    AttendanceAnalyticsService,
    AppointmentReminderOperationsService,
    AppointmentReminderWorker
  ],
  exports: [
    AppointmentsService,
    AttendanceAnalyticsService,
    AppointmentReminderOperationsService,
    AppointmentReminderWorker
  ]
})
export class AppointmentsModule {}
