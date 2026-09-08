import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { SettingsExpensesService } from "./settings-expenses.service";

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsExpensesService],
  exports: [SettingsService, SettingsExpensesService]
})
export class SettingsModule {}
