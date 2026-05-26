import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PriceListsController } from "./price-lists.controller";
import { PriceListsService } from "./price-lists.service";

@Module({
  imports: [PrismaModule],
  controllers: [PriceListsController],
  providers: [PriceListsService]
})
export class PriceListsModule {}
