import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { TreatmentPlansModule } from "../treatment-plans/treatment-plans.module";
import { AppointmentReprogrammingController } from "./appointment-reprogramming.controller";
import { AppointmentReprogrammingService } from "./appointment-reprogramming.service";

@Module({
  imports: [PrismaModule, AppointmentsModule, TreatmentPlansModule],
  controllers: [AppointmentReprogrammingController],
  providers: [AppointmentReprogrammingService]
})
export class AppointmentReprogrammingModule {}
