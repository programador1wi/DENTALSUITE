import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { IntegrationsController, PublicIntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import {
  ManualAiProvider,
  ManualNotificationProvider,
  ManualPaymentProvider,
  ManualPdfProvider
} from "./providers/integration-providers";

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController, PublicIntegrationsController],
  providers: [IntegrationsService, ManualNotificationProvider, ManualPaymentProvider, ManualAiProvider, ManualPdfProvider],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
