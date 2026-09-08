import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { IntegrationsController, PublicIntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import {
  ManualAiProvider,
  ManualNotificationProvider,
  PAYMENT_PROVIDER,
  ManualPaymentProvider,
  ManualPdfProvider
} from "./providers/integration-providers";

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController, PublicIntegrationsController],
  providers: [
    IntegrationsService,
    ManualNotificationProvider,
    { provide: PAYMENT_PROVIDER, useClass: ManualPaymentProvider },
    ManualAiProvider,
    ManualPdfProvider
  ],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
