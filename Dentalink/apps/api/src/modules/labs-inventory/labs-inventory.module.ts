import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaModule } from "../../database/prisma.module";
import { LabsInventoryController } from "./labs-inventory.controller";
import { LabsInventoryService } from "./labs-inventory.service";
import { InventoryApplicationService } from "./inventory/inventory-application.service";
import {
  EXTERNAL_INVENTORY_PROVIDER,
  INVENTORY_PROVIDER,
  LOCAL_INVENTORY_PROVIDER,
  type InventoryProviderMode
} from "./inventory/inventory-provider.port";

@Module({
  imports: [PrismaModule],
  controllers: [LabsInventoryController],
  providers: [
    LabsInventoryService,
    InventoryApplicationService,
    {
      provide: INVENTORY_PROVIDER,
      inject: [ConfigService, LabsInventoryService],
      useFactory: (config: ConfigService, localProvider: LabsInventoryService) => {
        const mode = (config.get<string>("INVENTORY_PROVIDER") ?? LOCAL_INVENTORY_PROVIDER) as InventoryProviderMode;
        if (mode === LOCAL_INVENTORY_PROVIDER) return localProvider;
        if (mode === EXTERNAL_INVENTORY_PROVIDER) {
          throw new Error(
            "INVENTORY_PROVIDER=EXTERNAL_API is reserved but cannot be enabled until the real external API contract is configured"
          );
        }
        throw new Error(`Unsupported INVENTORY_PROVIDER: ${mode}`);
      }
    }
  ],
  exports: [LabsInventoryService, InventoryApplicationService, INVENTORY_PROVIDER]
})
export class LabsInventoryModule {}
