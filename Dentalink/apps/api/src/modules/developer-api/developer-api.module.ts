import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { PatientsModule } from "../patients/patients.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { PatientFieldConfigModule } from "../patient-field-config/patient-field-config.module";
import { PricingModule } from "../pricing/pricing.module";
import { DeveloperPatientsController } from "./controllers/developer-patients.controller";
import { DeveloperAppointmentsController } from "./controllers/developer-appointments.controller";
import { DeveloperBudgetsController } from "./controllers/developer-budgets.controller";
import { DeveloperPricingController } from "./controllers/developer-pricing.controller";
import { DeveloperApiService } from "./developer-api.service";
import { DeveloperApiKeyGuard } from "../../common/guards/developer-api-key.guard";
import { DeveloperApiRateLimitGuard } from "../../common/guards/developer-api-rate-limit.guard";
import { ApiScopesGuard } from "../../common/guards/api-scopes.guard";

@Module({
  imports: [PrismaModule, RedisModule, PatientsModule, AppointmentsModule, PatientFieldConfigModule, PricingModule],
  controllers: [
    DeveloperPatientsController,
    DeveloperAppointmentsController,
    DeveloperBudgetsController,
    DeveloperPricingController
  ],
  providers: [DeveloperApiService, DeveloperApiKeyGuard, DeveloperApiRateLimitGuard, ApiScopesGuard],
  exports: [DeveloperApiService]
})
export class DeveloperApiModule {}
