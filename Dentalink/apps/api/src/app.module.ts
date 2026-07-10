import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment.validation";
import { AppLogger } from "./common/utils/app-logger.util";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { ClinicalModule } from "./modules/clinical/clinical.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { LabsInventoryModule } from "./modules/labs-inventory/labs-inventory.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PriceListsModule } from "./modules/price-lists/price-lists.module";
import { ProcedureCategoriesModule } from "./modules/procedure-categories/procedure-categories.module";
import { ProceduresModule } from "./modules/procedures/procedures.module";
import { ProfessionalsModule } from "./modules/professionals/professionals.module";
import { ProfessionalSchedulesModule } from "./modules/professional-schedules/professional-schedules.module";
import { RedisModule } from "./modules/redis/redis.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SpecialtiesModule } from "./modules/specialties/specialties.module";
import { ChairsModule } from "./modules/chairs/chairs.module";
import { PaymentMethodsModule } from "./modules/payment-methods/payment-methods.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { TreatmentPlansModule } from "./modules/treatment-plans/treatment-plans.module";
import { UsersModule } from "./modules/users/users.module";
import { OnlineSchedulingModule } from "./modules/online-scheduling/online-scheduling.module";
import { PublicBookingModule } from "./modules/public-booking/public-booking.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment
    }),
    PrismaModule,
    RedisModule,
    NotificationsModule,
    AppointmentsModule,
    AuthModule,
    ClinicalModule,
    CollectionsModule,
    DocumentsModule,
    LabsInventoryModule,
    UsersModule,
    RolesModule,
    SettingsModule,
    PermissionsModule,
    ReportsModule,
    BranchesModule,
    SpecialtiesModule,
    ProfessionalsModule,
    ProfessionalSchedulesModule,
    ChairsModule,
    PaymentMethodsModule,
    PatientsModule,
    PaymentsModule,
    ProcedureCategoriesModule,
    ProceduresModule,
    PriceListsModule,
    TreatmentPlansModule,
    HealthModule,
    OnlineSchedulingModule,
    PublicBookingModule,
    IntegrationsModule
  ],
  providers: [AppLogger],
  exports: [AppLogger]
})
export class AppModule {}
