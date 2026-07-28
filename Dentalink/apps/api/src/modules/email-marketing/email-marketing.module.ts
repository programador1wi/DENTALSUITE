import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EmailMarketingController, PublicEmailMarketingController } from "./email-marketing.controller";
import { EmailMarketingReportsService } from "./email-marketing-reports.service";
import { EmailMarketingService } from "./email-marketing.service";
import { EmailMarketingWorker } from "./email-marketing.worker";
import { MarketingRecipientEligibilityService } from "./marketing-recipient-eligibility.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [EmailMarketingController, PublicEmailMarketingController],
  providers: [EmailMarketingService, EmailMarketingReportsService, MarketingRecipientEligibilityService, EmailMarketingWorker],
  exports: [EmailMarketingService, MarketingRecipientEligibilityService]
})
export class EmailMarketingModule {}
