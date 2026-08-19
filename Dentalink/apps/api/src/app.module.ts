import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment.validation";
import { AppLogger } from "./common/utils/app-logger.util";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AppointmentReprogrammingModule } from "./modules/appointment-reprogramming/appointment-reprogramming.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { ClinicalModule } from "./modules/clinical/clinical.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { HealthCenterModule } from "./modules/health-center/health-center.module";
import { LabsInventoryModule } from "./modules/labs-inventory/labs-inventory.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PermissionProfilesModule } from "./modules/permission-profiles/permission-profiles.module";
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
import { PhotographicTemplatesModule } from "./modules/photographic-templates/photographic-templates.module";
import { PatientIdentityModule } from "./modules/patient-identity/patient-identity.module";
import { PatientFieldConfigModule } from "./modules/patient-field-config/patient-field-config.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { FamilyPoliciesModule } from "./modules/family-policies/family-policies.module";
import { AgreementDebtsModule } from "./modules/agreement-debts/agreement-debts.module";
import { OrthodonticsModule } from "./modules/orthodontics/orthodontics.module";
import { DiscountPoliciesModule } from "./modules/discount-policies/discount-policies.module";
import { CashDiscountsModule } from "./modules/cash-discounts/cash-discounts.module";
import { EmailMarketingModule } from "./modules/email-marketing/email-marketing.module";
import { CrmSurveysModule } from "./modules/crm-surveys/crm-surveys.module";
import { CrmTasksModule } from "./modules/crm-tasks/crm-tasks.module";
import { CollaboratorsModule } from "./modules/collaborators/collaborators.module";

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
    AppointmentReprogrammingModule,
    AuthModule,
    ClinicalModule,
    CollectionsModule,
    DocumentsModule,
    LabsInventoryModule,
    UsersModule,
    RolesModule,
    SettingsModule,
    PermissionsModule,
    PermissionProfilesModule,
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
    PricingModule,
    TreatmentPlansModule,
    DiscountPoliciesModule,
    CashDiscountsModule,
    HealthModule,
    HealthCenterModule,
    OnlineSchedulingModule,
    PublicBookingModule,
    IntegrationsModule,
    PhotographicTemplatesModule,
    PatientIdentityModule,
    PatientFieldConfigModule,
    FamilyPoliciesModule,
    AgreementDebtsModule,
    OrthodonticsModule,
    EmailMarketingModule,
    CrmSurveysModule,
    CrmTasksModule,
    CollaboratorsModule
  ],
  providers: [AppLogger],
  exports: [AppLogger]
})
export class AppModule {}
