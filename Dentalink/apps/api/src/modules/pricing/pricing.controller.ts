import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  CreatePriceListVersionDto,
  ApplyPriceTemplatePreviewDto,
  CopyPriceItemsDto,
  CreatePriceImportDto,
  CreatePriceTemplateDto,
  CreateVersionedPriceListDto,
  PublishPriceListVersionDto,
  ResolvePriceDto,
  SchedulePriceListVersionDto,
  UpdateVersionedPriceListDto,
  UpsertVersionItemDto
} from "./dto/pricing.dto";
import { PricingService } from "./pricing.service";

@ApiTags("Pricing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post("resolve")
  @RequirePermissions("price_list.view")
  resolve(@CurrentUser() actor: AuthUser, @Body() dto: ResolvePriceDto) {
    return this.pricing.resolve(actor, dto);
  }
}

@ApiTags("AdminPriceLists")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin")
export class AdminPriceListsController {
  constructor(private readonly pricing: PricingService) {}

  @Get("price-lists")
  @RequirePermissions("price_list.view")
  list(@CurrentUser() actor: AuthUser, @Query("search") search?: string, @Query("includeInactive") includeInactive?: string) {
    return this.pricing.list(actor, search, includeInactive === "true");
  }

  @Post("price-lists")
  @RequirePermissions("price_list.create")
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateVersionedPriceListDto) {
    return this.pricing.createList(actor, dto);
  }

  @Get("price-lists/:id")
  @RequirePermissions("price_list.view")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.getList(actor, id);
  }

  @Get("price-lists/:id/history")
  @RequirePermissions("price_list.view")
  history(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("action") action?: string
  ) {
    return this.pricing.history(actor, id, Number(page ?? 1), Number(pageSize ?? 50), action);
  }

  @Patch("price-lists/:id")
  @RequirePermissions("price_list.edit_draft")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateVersionedPriceListDto) {
    return this.pricing.updateList(actor, id, dto);
  }

  @Post("price-lists/:id/versions")
  @RequirePermissions("price_list.edit_draft")
  createVersion(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreatePriceListVersionDto) {
    return this.pricing.createVersion(actor, id, dto);
  }

  @Get("price-list-versions/:id/items")
  @RequirePermissions("price_list.view")
  items(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.getVersionItems(actor, id);
  }

  @Post("price-list-versions/:id/items")
  @RequirePermissions("price_list.edit_draft")
  upsertItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpsertVersionItemDto) {
    return this.pricing.upsertVersionItem(actor, id, dto);
  }

  @Patch("price-list-items/:id")
  @RequirePermissions("price_list.edit_draft")
  updateItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpsertVersionItemDto) {
    return this.pricing.updateVersionItem(actor, id, dto);
  }

  @Post("price-list-items/:id/deactivate")
  @RequirePermissions("price_list.edit_draft")
  deactivateItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body("expectedVersion") expectedVersion: number) {
    return this.pricing.deactivateVersionItem(actor, id, expectedVersion);
  }

  @Post("price-list-versions/:id/validate")
  @RequirePermissions("price_list.edit_draft")
  validate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.validateVersion(actor, id);
  }

  @Post("price-list-versions/:id/publish")
  @RequirePermissions("price_list.publish")
  publish(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: PublishPriceListVersionDto) {
    return this.pricing.publishVersion(actor, id, dto);
  }

  @Post("price-list-versions/:id/schedule")
  @RequirePermissions("price_list.schedule")
  schedule(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: SchedulePriceListVersionDto) {
    return this.pricing.scheduleVersion(actor, id, dto);
  }

  @Post("price-list-versions/:id/deactivate")
  @RequirePermissions("price_list.deactivate")
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body("expectedVersion") expectedVersion: number,
    @Body("reason") reason?: string,
    @Headers("correlation-id") _correlationId?: string
  ) {
    return this.pricing.deactivateVersion(actor, id, expectedVersion, reason);
  }

  @Post("price-lists/:id/copy-preview")
  @RequirePermissions("price_list.edit_draft")
  copyPreview(@CurrentUser() actor: AuthUser, @Param("id") _id: string, @Body() dto: CopyPriceItemsDto) {
    return this.pricing.copyPreview(actor, dto);
  }

  @Post("price-lists/:id/copy-apply")
  @RequirePermissions("price_list.edit_draft")
  copyApply(
    @CurrentUser() actor: AuthUser,
    @Param("id") _id: string,
    @Body() dto: CopyPriceItemsDto,
    @Headers("idempotency-key") idempotencyKey: string
  ) {
    return this.pricing.copyApply(actor, dto, idempotencyKey);
  }

  @Get("price-templates")
  @RequirePermissions("price_template.view")
  templates(@CurrentUser() actor: AuthUser) {
    return this.pricing.listTemplates(actor);
  }

  @Post("price-templates")
  @RequirePermissions("price_template.manage")
  createTemplate(@CurrentUser() actor: AuthUser, @Body() dto: CreatePriceTemplateDto) {
    return this.pricing.createTemplate(actor, dto);
  }

  @Post("price-templates/:id/apply-preview")
  @RequirePermissions("price_template.view")
  applyTemplatePreview(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ApplyPriceTemplatePreviewDto
  ) {
    return this.pricing.applyTemplatePreview(actor, id, dto);
  }

  @Get("price-imports/template")
  @RequirePermissions("price_list.import")
  importTemplate() {
    return {
      columns: [
        "code",
        "name",
        "category",
        "type",
        "price",
        "currency",
        "allowDiscount",
        "maxDiscountPercent",
        "laboratoryCost",
        "internalCost",
        "specialty",
        "status"
      ]
    };
  }

  @Post("price-imports")
  @RequirePermissions("price_list.import")
  createImport(@CurrentUser() actor: AuthUser, @Body() dto: CreatePriceImportDto) {
    return this.pricing.createImport(actor, dto);
  }

  @Get("price-imports/:id")
  @RequirePermissions("price_list.import")
  getImport(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.getImport(actor, id);
  }

  @Post("price-imports/:id/apply")
  @RequirePermissions("price_list.import")
  applyImport(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.applyImport(actor, id);
  }

  @Post("price-imports/:id/revert")
  @RequirePermissions("price_list.import")
  revertImport(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.pricing.revertImport(actor, id);
  }
}
