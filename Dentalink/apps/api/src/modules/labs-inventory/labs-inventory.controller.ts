import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CreateInventoryItemDto,
  CreateInventoryMovementDto,
  CreateLabOrderDto,
  CreateLabOrderFromTreatmentDto,
  CreateLabProviderDto,
  CreateSupplierDto,
  ListInventoryItemsQueryDto,
  ListInventoryMovementsQueryDto,
  ListLabOrdersQueryDto,
  ListLabProvidersQueryDto,
  ListSuppliersQueryDto,
  UpdateInventoryItemDto,
  UpdateLabOrderCostDto,
  UpdateLabOrderStatusDto,
  UpdateLabProviderDto,
  UpdateSupplierDto
} from "./dto/labs-inventory.dto";
import { LabsInventoryService } from "./labs-inventory.service";

@ApiTags("Labs & Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class LabsInventoryController {
  constructor(private readonly service: LabsInventoryService) {}

  @Get("labs/providers")
  @RequirePermissions("lab_providers.read")
  listLabProviders(@CurrentUser() actor: AuthUser, @Query() query: ListLabProvidersQueryDto) {
    return this.service.listLabProviders(actor, query);
  }

  @Post("labs/providers")
  @RequirePermissions("lab_providers.create")
  createLabProvider(@CurrentUser() actor: AuthUser, @Body() dto: CreateLabProviderDto) {
    return this.service.createLabProvider(actor, dto);
  }

  @Patch("labs/providers/:id")
  @RequirePermissions("lab_providers.update")
  updateLabProvider(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateLabProviderDto) {
    return this.service.updateLabProvider(actor, id, dto);
  }

  @Patch("labs/providers/:id/deactivate")
  @RequirePermissions("lab_providers.deactivate")
  deactivateLabProvider(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivateLabProvider(actor, id);
  }

  @Get("labs/orders")
  @RequirePermissions("lab_orders.read")
  listLabOrders(@CurrentUser() actor: AuthUser, @Query() query: ListLabOrdersQueryDto) {
    return this.service.listLabOrders(actor, query);
  }

  @Post("labs/orders")
  @RequirePermissions("lab_orders.create")
  createLabOrder(@CurrentUser() actor: AuthUser, @Body() dto: CreateLabOrderDto) {
    return this.service.createLabOrder(actor, dto);
  }

  @Post("labs/orders/from-treatment/:treatmentPlanId")
  @RequirePermissions("lab_orders.create")
  createLabOrderFromTreatment(
    @CurrentUser() actor: AuthUser,
    @Param("treatmentPlanId") treatmentPlanId: string,
    @Body() dto: CreateLabOrderFromTreatmentDto
  ) {
    return this.service.createLabOrderFromTreatment(actor, treatmentPlanId, dto);
  }

  @Get("labs/orders/:id")
  @RequirePermissions("lab_orders.read")
  getLabOrder(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getLabOrder(actor, id);
  }

  @Patch("labs/orders/:id/status")
  @RequirePermissions("lab_orders.update")
  updateLabOrderStatus(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateLabOrderStatusDto) {
    return this.service.updateLabOrderStatus(actor, id, dto);
  }

  @Patch("labs/orders/:id/cost")
  @RequirePermissions("lab_orders.cost.update")
  updateLabOrderCost(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateLabOrderCostDto) {
    return this.service.updateLabOrderCost(actor, id, dto);
  }

  @Get("labs/profitability")
  @RequirePermissions("lab_profitability.read")
  getTreatmentLabProfitability(@CurrentUser() actor: AuthUser, @Query("treatmentPlanId") treatmentPlanId: string) {
    return this.service.getTreatmentLabProfitability(actor, treatmentPlanId);
  }

  @Get("suppliers")
  @RequirePermissions("suppliers.read")
  listSuppliers(@CurrentUser() actor: AuthUser, @Query() query: ListSuppliersQueryDto) {
    return this.service.listSuppliers(actor, query);
  }

  @Post("suppliers")
  @RequirePermissions("suppliers.create")
  createSupplier(@CurrentUser() actor: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(actor, dto);
  }

  @Patch("suppliers/:id")
  @RequirePermissions("suppliers.update")
  updateSupplier(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.updateSupplier(actor, id, dto);
  }

  @Patch("suppliers/:id/deactivate")
  @RequirePermissions("suppliers.deactivate")
  deactivateSupplier(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivateSupplier(actor, id);
  }

  @Get("inventory/items")
  @RequirePermissions("inventory.read")
  listInventoryItems(@CurrentUser() actor: AuthUser, @Query() query: ListInventoryItemsQueryDto) {
    return this.service.listInventoryItems(actor, query);
  }

  @Post("inventory/items")
  @RequirePermissions("inventory.create")
  createInventoryItem(@CurrentUser() actor: AuthUser, @Body() dto: CreateInventoryItemDto) {
    return this.service.createInventoryItem(actor, dto);
  }

  @Patch("inventory/items/:id")
  @RequirePermissions("inventory.update")
  updateInventoryItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.service.updateInventoryItem(actor, id, dto);
  }

  @Patch("inventory/items/:id/deactivate")
  @RequirePermissions("inventory.deactivate")
  deactivateInventoryItem(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.deactivateInventoryItem(actor, id);
  }

  @Get("inventory/movements")
  @RequirePermissions("inventory.movements.read")
  listInventoryMovements(@CurrentUser() actor: AuthUser, @Query() query: ListInventoryMovementsQueryDto) {
    return this.service.listInventoryMovements(actor, query);
  }

  @Post("inventory/movements")
  @RequirePermissions("inventory.movements.create")
  createInventoryMovement(@CurrentUser() actor: AuthUser, @Body() dto: CreateInventoryMovementDto) {
    return this.service.createInventoryMovement(actor, dto);
  }

  @Get("inventory/alerts/min-stock")
  @RequirePermissions("inventory.alerts.read")
  listMinStockAlerts(@CurrentUser() actor: AuthUser, @Query("branchId") branchId?: string) {
    return this.service.listMinStockAlerts(actor, branchId);
  }
}
