import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AgreementDebtsController, CompanyPaymentsController } from "./agreement-debts.controller";
import { AgreementDebtsService } from "./agreement-debts.service";

@Module({
  imports: [PrismaModule],
  controllers: [AgreementDebtsController, CompanyPaymentsController],
  providers: [AgreementDebtsService],
  exports: [AgreementDebtsService]
})
export class AgreementDebtsModule {}
