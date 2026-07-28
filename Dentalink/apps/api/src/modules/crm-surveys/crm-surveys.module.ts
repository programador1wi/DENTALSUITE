import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  CrmSurveyQuestionsController,
  CrmSurveySectionsController,
  CrmSurveysController,
  CrmSurveySendConfigurationController,
  PublicCrmSurveysController
} from "./crm-surveys.controller";
import { CrmSurveysService } from "./crm-surveys.service";
import { CrmSurveysWorker } from "./crm-surveys.worker";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    CrmSurveysController,
    CrmSurveySectionsController,
    CrmSurveyQuestionsController,
    CrmSurveySendConfigurationController,
    PublicCrmSurveysController
  ],
  providers: [CrmSurveysService, CrmSurveysWorker],
  exports: [CrmSurveysService]
})
export class CrmSurveysModule {}
